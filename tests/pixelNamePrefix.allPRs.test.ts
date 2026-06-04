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

    it("warns for PixelKit-style return with m_ prefix", async () => {
        dm.addedLines = `
+        case .errorPageShown:
+            return "m_malicious-site-protection_error-page-shown"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("m_malicious-site-protection_error-page-shown")
        expect(warnMessage).toContain("return")
    })

    it("does not warn for PixelKit return without m_ prefix", async () => {
        dm.addedLines = `
+        case .errorPageShown:
+            return "malicious-site-protection_error-page-shown"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out return with m_ prefix", async () => {
        dm.addedLines = `
+        // return "m_app_launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed return with m_ prefix", async () => {
        dm.addedLines = `
-            return "m_app_launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns for multiple PixelKit returns and lists each", async () => {
        dm.addedLines = `
+        case .errorPageShown:
+            return "m_error_page_shown"
+        case .visitSite:
+            return "m_visit_site"
+        case .okayCase:
+            return "feature_okay"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("m_error_page_shown")
        expect(warnMessage).toContain("m_visit_site")
        expect(warnMessage).not.toContain("feature_okay")
    })

    it("warns for enum case rawValue with m- (dashed) prefix", async () => {
        dm.addedLines = `
+        case appLaunch = "m-app-launch"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("m-app-launch")
    })

    it("warns for PixelKit return with m- (dashed) prefix", async () => {
        dm.addedLines = `
+        case .dangerDashedOldPixel:
+            return "m-danger-pixelkit-dashed_warn"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("m-danger-pixelkit-dashed_warn")
    })

    it("does not warn for names starting with m followed by a letter (no separator)", async () => {
        // Guards against false positives like `malicious-site-protection_*`,
        // `mac_browser_*`, `match_foo`, etc. – these start with `m` but lack
        // the `_` or `-` separator that defines the deprecated prefix.
        dm.addedLines = `
+        case .errorPageShown:
+            return "malicious-site-protection_error-page-shown"
+        case .macBrowser:
+            return "mac_browser_open"
+        case .matchFoo = "match_foo"
        `

        await pixelNamePrefix()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns for inline switch case with m_ return (iOS PixelEvent style)", async () => {
        dm.addedLines = `
+        case .dangerIssueOldPixel: return "m_danger_test_warn"
+        case .dangerNoIssue: return "danger_test_no_issue"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("m_danger_test_warn")
        expect(warnMessage).not.toContain("danger_test_no_issue")
    })

    it("warns for mixed enum case and PixelKit return in one diff", async () => {
        dm.addedLines = `
+        case appLaunch = "m_app_launch"
+        case .errorPageShown:
+            return "m_error_page_shown"
        `

        await pixelNamePrefix()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("case appLaunch")
        expect(warnMessage).toContain("m_app_launch")
        expect(warnMessage).toContain("m_error_page_shown")
        expect(warnMessage).toContain("return")
    })
})
