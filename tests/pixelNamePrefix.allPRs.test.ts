jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { pixelNamePrefix } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "ModifiedFile.swift"
            ],
            created_files: [
                "CreatedFile.swift"
            ]
        }
    }
})

describe("pixel name prefix warning", () => {
    it("does not warn with no changes to Swift files", async () => {
        dm.danger.git.modified_files = ["ModifiedFile.m"]
        dm.danger.git.created_files = []

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for case without m_ prefix", async () => {
        dm.addedLines = `
+        case appLaunch = "feature_search_open"
+        case anotherEvent = "newtab_show"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when m_ appears outside of a rawValue string", async () => {
        dm.addedLines = `
+        // legacy notes about m_ prefix history
+        let label = "this mentions m_something but is not a case"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out case with m_ prefix", async () => {
        dm.addedLines = `
+        // case appLaunch = "m_app_launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed case with m_ prefix", async () => {
        dm.addedLines = `
-        case appLaunch = "m_app_launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when an enum case rawValue starts with m_", async () => {
        dm.addedLines = `
+        case appLaunch = "m_app_launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("appLaunch")
        expect(warnMessage).toContain("m_app_launch")
        expect(warnMessage).toContain("m_")
    })

    it("warns for case with associated value when rawValue starts with m_", async () => {
        dm.addedLines = `
+        case openSomething(String) = "m_open_something"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })

    it("lists multiple offending cases in a single warning", async () => {
        dm.addedLines = `
+        case appLaunch = "m_app_launch"
+        case settingsOpen = "m_settings_open"
+        case okayCase = "feature_okay"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("appLaunch")
        expect(warnMessage).toContain("settingsOpen")
        expect(warnMessage).not.toContain("okayCase")
    })

    it("warns for cases added in macOS files", async () => {
        dm.danger.git.modified_files = ["macOS/DuckDuckGo/Statistics/Pixel.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+        case macFeature = "m_mac_feature_open"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })

    it("warns for cases added in iOS files", async () => {
        dm.danger.git.modified_files = ["iOS/Core/PixelEvent.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+        case iosFeature = "m_ios_feature_open"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })
})
