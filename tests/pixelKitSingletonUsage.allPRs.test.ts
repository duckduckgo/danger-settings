jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { pixelKitSingletonUsage } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "macOS/DuckDuckGo/SomeFeature.swift"
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

describe("PixelKit singleton usage checks", () => {
    it("does not warn with no changes to Swift files", async () => {
        dm.danger.git.modified_files = ["ModifiedFile.m"]
        dm.danger.git.created_files = []

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no additions", async () => {
        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "BrowserServicesKit"
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when a static PixelKit.fire is added", async () => {
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily)")
        expect(warnMessage).toContain("PixelKitFiring")
    })

    it("warns when a static PixelKit.fireAsync is added", async () => {
        dm.addedLines = `
+        try await PixelKit.fireAsync(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("try await PixelKit.fireAsync(GeneralPixel.appLaunch)")
    })

    it("warns when firing through PixelKit.shared", async () => {
        dm.addedLines = `
+        PixelKit.shared?.fire(GeneralPixel.appLaunch)
+        PixelKit.shared!.fireAsync(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("PixelKit.shared?.fire(GeneralPixel.appLaunch)")
        expect(warnMessage).toContain("PixelKit.shared!.fireAsync(GeneralPixel.appLaunch)")
    })

    it("warns when the legacy wide-parameter static entry point is used", async () => {
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch, frequency: .daily, withAdditionalParameters: params)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })

    it("does not warn when PixelKit.shared is injected as a dependency", async () => {
        dm.addedLines = `
+    init(pixelFiring: any PixelKitFiring = PixelKit.shared) {
+        self.pixelFiring = pixelFiring
+    }
+    let telemetry = Telemetry(pixelFiring: PixelKit.shared)
+    var pixelKit: () -> (any PixelKitFiring)? = { PixelKit.shared }
+    guard let pixelKit = PixelKit.shared else { return }
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when firing through an injected dependency", async () => {
        dm.addedLines = `
+        pixelFiring.fire(GeneralPixel.appLaunch, frequency: .daily)
+        pixelKit.fire(GeneralPixel.appLaunch)
+        self.pixelFiring?.fire(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for PixelKit setup and teardown", async () => {
        dm.addedLines = `
+        PixelKit.setUp(dryRun: false, appVersion: version, defaultHeaders: [:], fireRequest: request)
+        PixelKit.tearDown()
+        PixelKit.setSharedForTesting(pixelKit: mock)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out singleton usage", async () => {
        dm.addedLines = `
+        // PixelKit.fire(GeneralPixel.appLaunch)
+        /// PixelKit.shared?.fire(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed singleton usage", async () => {
        dm.addedLines = `
-        PixelKit.fire(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for the legacy iOS Pixel API", async () => {
        dm.addedLines = `
+        Pixel.fire(pixel: .appLaunch)
+        DailyPixel.fire(pixel: .appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn inside the PixelKit package itself", async () => {
        dm.danger.git.modified_files = ["SharedPackages/PixelKit/Sources/PixelKit/WideEvent/WideEventFailureEvent.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+        PixelKit.shared?.fire(event, frequency: .dailyAndCount)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn in tests, test utilities and mocks", async () => {
        dm.danger.git.modified_files = [
            "iOS/DuckDuckGoTests/SomeFeature.swift",
            "macOS/UnitTests/SomeFeature.swift",
            "SharedPackages/VPN/Sources/VPNTestUtils/Helper.swift"
        ]
        dm.danger.git.created_files = ["macOS/DuckDuckGo/PixelKitMock+Verify.swift"]
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("lists every offending line across files in a single warning", async () => {
        dm.addedLines = `
+        PixelKit.fire(GeneralPixel.appLaunch)
+        let ok = PixelKit.shared
+        PixelKit.shared?.fire(GeneralPixel.appCrash)
        `

        await pixelKitSingletonUsage()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("macOS/DuckDuckGo/SomeFeature.swift")
        expect(warnMessage).toContain("iOS/DuckDuckGo/AnotherFeature.swift")
        expect(warnMessage).toContain("PixelKit.fire(GeneralPixel.appLaunch)")
        expect(warnMessage).toContain("PixelKit.shared?.fire(GeneralPixel.appCrash)")
        expect(warnMessage).not.toContain("let ok = PixelKit.shared")
    })
})
