jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { legacyPixelUsage } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

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
    it("does not fail with no changes to Swift files", async () => {
        dm.danger.git.modified_files = ["ModifiedFile.m"]
        dm.danger.git.created_files = []

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails when a new Pixel.fire is added", async () => {
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("Pixel.fire(pixel: .appLaunch)")
        expect(failMessage).toContain("PixelKit")
    })

    it("fails when a Pixel.Event reference is added", async () => {
        dm.addedLines = `
+        let event: Pixel.Event = .appLaunch
        `

        await legacyPixelUsage()
        expect(dm.fail).toHaveBeenCalledTimes(1)
    })

    it("fails for DailyPixel, UniquePixel, TimedPixel and PersistentPixel", async () => {
        dm.addedLines = `
+        DailyPixel.fire(pixel: .foo)
+        UniquePixel.fire(pixel: .bar)
+        let timed = TimedPixel(.baz)
+        let persistent = PersistentPixel()
        `

        await legacyPixelUsage()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("DailyPixel")
        expect(failMessage).toContain("UniquePixel")
        expect(failMessage).toContain("TimedPixel")
        expect(failMessage).toContain("PersistentPixel")
    })

    it("does not fail for PixelKit usage", async () => {
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily)
+        let handler: PixelFiring = PixelKit.shared
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail for lookalike identifiers", async () => {
        dm.addedLines = `
+        let somePixel = makePixel()
+        somePixel.fire()
+        let n = PixelParameters.appVersion
+        experimentPixelStore.append(pixel)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail for commented-out legacy usage", async () => {
        dm.addedLines = `
+        // Pixel.fire(pixel: .appLaunch)
+        // DailyPixel.fire(pixel: .foo)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail for removed legacy usage", async () => {
        dm.addedLines = `
-        Pixel.fire(pixel: .appLaunch)
-        TimedPixel(.baz)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail when the legacy definition files themselves change", async () => {
        dm.danger.git.modified_files = ["iOS/Core/PersistentPixel.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+        Pixel.fire(pixel: pixel, error: error)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail when test or mock files use legacy pixels", async () => {
        dm.danger.git.modified_files = ["iOS/DuckDuckGoTests/PixelTests.swift"]
        dm.danger.git.created_files = ["iOS/DuckDuckGo/PixelFiringMock.swift"]
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
        `

        await legacyPixelUsage()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("lists multiple offending lines in a single failure", async () => {
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
+        let ok = PixelKit.shared
+        TimedPixel(.baz).fire()
        `

        await legacyPixelUsage()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("Pixel.fire(pixel: .appLaunch)")
        expect(failMessage).toContain("TimedPixel(.baz).fire()")
    })
})
