jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { noNewPixelEventCases } from '../org/allPRs'

const PIXEL_EVENT_FILE = "iOS/Core/PixelEvent.swift"

beforeEach(() => {
    dm.addedLines = ""
    dm.removedLines = ""
    dm.beforeContent = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines, removed: dm.removedLines, before: dm.beforeContent }
            },
            modified_files: [PIXEL_EVENT_FILE],
            created_files: []
        },
        github: {
            thisPR: {
                repo: "apple-browsers"
            }
        },
    }
})

describe("no new PixelEvent.swift cases check", () => {
    it("does not fail when PixelEvent.swift is not touched", async () => {
        dm.danger.git.modified_files = ["iOS/DuckDuckGo/SomeFeature.swift"]
        dm.addedLines = `
+        case appLaunch
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        dm.addedLines = `
+        case appLaunch
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no diff", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails when a brand new bare case is added", async () => {
        dm.addedLines = `
+        case appLaunchFromWidget
        `

        await noNewPixelEventCases()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("case appLaunchFromWidget")
        expect(failMessage).toContain("PixelKit.Event")
    })

    it("fails when a brand new case with associated values is added", async () => {
        dm.addedLines = `
+        case widgetError(underlyingError: Error)
        `

        await noNewPixelEventCases()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("case widgetError(underlyingError: Error)")
    })

    it("fails when a brand new switch arm is added", async () => {
        dm.addedLines = `
+        case .appLaunchFromWidget: return "m_app_launch_widget"
        `

        await noNewPixelEventCases()
        expect(dm.fail).toHaveBeenCalledTimes(1)
    })

    it("does not fail when only removing a case", async () => {
        dm.removedLines = `
-        case appLaunchFromWidget
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail when modifying an existing case's name string", async () => {
        dm.beforeContent = `
        case appLaunch
        case .appLaunch: return "m_app_launch"
        `
        dm.removedLines = `
-        case .appLaunch: return "m_app_launch"
        `
        dm.addedLines = `
+        case .appLaunch: return "m_app_launch_v2"
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail when modifying an existing case's associated values", async () => {
        dm.beforeContent = `
        case widgetError(error: Error)
        `
        dm.removedLines = `
-        case widgetError(error: Error)
        `
        dm.addedLines = `
+        case widgetError(error: Error, isRetry: Bool)
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail when a new switch arm reuses a pre-existing case with no removed lines", async () => {
        // Simulates a brand new per-case property added over cases that already existed in
        // the file - nothing is removed, so the old removed-lines comparison would have
        // misflagged `appLaunch` as new even though it's unrelated to this switch.
        dm.beforeContent = `
        case appLaunch
        case appLaunchFromWidget
        `
        dm.addedLines = `
+        case .appLaunch: return .foreground
+        case .appLaunchFromWidget: return .widget
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail for commented-out additions", async () => {
        dm.addedLines = `
+        // case appLaunchFromWidget
        `

        await noNewPixelEventCases()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("lists multiple new cases in a single failure", async () => {
        dm.addedLines = `
+        case appLaunchFromWidget
+        case .appLaunchFromWidget: return "m_app_launch_widget"
        `

        await noNewPixelEventCases()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("case appLaunchFromWidget")
        expect(failMessage).toContain("case .appLaunchFromWidget: return \"m_app_launch_widget\"")
    })
})
