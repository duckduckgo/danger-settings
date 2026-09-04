jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { legacyPixelUsage } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "iOS/DuckDuckGo/SomeFeature.swift"
            ],
            created_files: [
                "iOS/DuckDuckGo/AnotherFeature.swift"
            ]
        },
        github: {
            thisPR: {
                repo: "apple-browsers"
            }
        },
    }
})

describe("legacy pixel usage checks", () => {
    it("does not warn with no changes to Swift files", async () => {
        dm.danger.git.modified_files = ["ModifiedFile.m"]
        dm.danger.git.created_files = []

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no additions", async () => {
        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when a new Pixel.fire is added", async () => {
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("Pixel.fire(pixel: .appLaunch)")
        expect(warnMessage).toContain("PixelKit")
    })

    it("warns when a Pixel.Event reference is added", async () => {
        dm.addedLines = `
+        let event: Pixel.Event = .appLaunch
        `

        await legacyPixelUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })

    it("warns for DailyPixel, UniquePixel, TimedPixel and PersistentPixel", async () => {
        dm.addedLines = `
+        DailyPixel.fire(pixel: .foo)
+        UniquePixel.fire(pixel: .bar)
+        let timed = TimedPixel(.baz)
+        let persistent = PersistentPixel()
        `

        await legacyPixelUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("DailyPixel")
        expect(warnMessage).toContain("UniquePixel")
        expect(warnMessage).toContain("TimedPixel")
        expect(warnMessage).toContain("PersistentPixel")
    })

    it("does not warn for PixelKit usage", async () => {
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily)
+        let handler: PixelFiring = PixelKit.shared
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for lookalike identifiers", async () => {
        dm.addedLines = `
+        let somePixel = makePixel()
+        somePixel.fire()
+        let n = PixelParameters.appVersion
+        experimentPixelStore.append(pixel)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out legacy usage", async () => {
        dm.addedLines = `
+        // Pixel.fire(pixel: .appLaunch)
+        // DailyPixel.fire(pixel: .foo)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed legacy usage", async () => {
        dm.addedLines = `
-        Pixel.fire(pixel: .appLaunch)
-        TimedPixel(.baz)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when the pixel catalogue files themselves change", async () => {
        dm.danger.git.modified_files = ["iOS/Core/PixelEvent.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+        Pixel.fire(pixel: pixel, error: error)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when test or mock files use legacy pixels", async () => {
        dm.danger.git.modified_files = ["iOS/DuckDuckGoTests/PixelTests.swift"]
        dm.danger.git.created_files = ["iOS/DuckDuckGo/PixelFiringMock.swift"]
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("lists multiple offending lines in a single warning", async () => {
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
+        let ok = PixelKit.shared
+        TimedPixel(.baz).fire()
        `

        await legacyPixelUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("Pixel.fire(pixel: .appLaunch)")
        expect(warnMessage).toContain("TimedPixel(.baz).fire()")
    })
})
