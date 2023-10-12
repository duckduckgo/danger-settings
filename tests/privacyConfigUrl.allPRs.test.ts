jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { embeddedFilesURLMismatch } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            modified_files: ["Core/AppConfigurationURLProvider.swift"],
            created_files: [],
            deleted_files: [],
        },
        github: {
            thisPR: {
                repo: "iOS"
            },
            utils: {
                fileContents: jest.fn(),
            }
        },
    };

    dm.danger.github.utils.fileContents.mockReturnValue(Promise.resolve(""));
})

describe("Privacy Config URL checks on iOS", () => {
    it("does not fail with no changes to relevant files", async () => {
        dm.danger.git.modified_files = []

        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with unrelevant changes to relevant files", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "Core/AppURLs.swift"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/config/v3/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v3/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!\r\n";
        appUrlsContent += "static let bloomFilter = URL(string: \"\\(staticBase)/https/https-mobileNEW-v2-bloom.bin\")!"

        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with mismatching changes (only AppURLs.swift changed)", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "Core/AppURLs.swift"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/config/v3/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v4/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check Core/AppURLs.swift and scripts/update_embedded.sh")
    })

    it("fails with mismatching changes (only update_embedded.sh changed)", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "scripts/update_embedded.sh"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/config/v4/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v3/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check Core/AppURLs.swift and scripts/update_embedded.sh")
    })

    it("fails with mismatching changes (both files changed)", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "scripts/update_embedded.sh", "Core/AppURLs.swift"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/config/v5/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v4/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check Core/AppURLs.swift and scripts/update_embedded.sh")
    })

    it("does not fail with matching changes (both files changed)", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "scripts/update_embedded.sh", "Core/AppURLs.swift"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/config/v4/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v4/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with not matching regex", async () => {
        dm.danger.git.modified_files = ["DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "scripts/update_embedded.sh", "Core/AppURLs.swift"]
        var updateEmbeddedContent = "performUpdate 'https://staticcdn.duckduckgo.com/trackerblocking/v5/current/ios-tds.json' \"${base_dir}/Core/AppTrackerDataSetProvider.swift\" \"${base_dir}/Core/trackerData.json\\r\n";
        updateEmbeddedContent += "performUpdate2 'https://staticcdn.duckduckgo.com/trackerblocking/config/v3/ios-config.json' \"${base_dir}/Core/AppPrivacyConfigurationDataProvider.swift\" \"${base_dir}/Core/ios-config.json\"";

        var appUrlsContent = "static let privacyConfig = URL(string: \"\\(staticBase)/trackerblocking/config/v3/ios-config.json\")!\r\n";
        appUrlsContent+= "static let trackerDataSet = URL(string: \"\\(staticBase)/trackerblocking/v5/current/ios-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check Core/AppURLs.swift and scripts/update_embedded.sh")
    })

})

describe("Privacy Config URL checks on macOS", () => {
    it("does not fail with no changes to relevant files", async () => {
        dm.danger.git.modified_files = []
        dm.danger.github.thisPR.repo = "macos-browser"
        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with unrelevant changes to relevant files", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v3/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positivesNEW.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v3/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!";

        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with mismatching changes (only AppConfigurationURLProvider.swift changed)", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v3/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positives.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift and scripts/update_embedded.sh")
    })

    it("fails with mismatching changes (only update_embedded.sh changed)", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "scripts/update_embedded.sh"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v3/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positives.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift and scripts/update_embedded.sh")
    })

    it("fails with mismatching changes (both files changed)", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "scripts/update_embedded.sh", "DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positives.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v5/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift and scripts/update_embedded.sh")
    })

    it("does not fail with matching changes (both files changed)", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "scripts/update_embedded.sh", "DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positives.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with not matching regex", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.danger.git.modified_files = ["DuckDuckGo/AppDelegate/CopyHandler.swift", "scripts/update_embedded.sh", "DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift"]
        var updateEmbeddedContent = "TDS_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\"\r\n";
        updateEmbeddedContent += "CONFIG_URL=\"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\"";

        var appUrlsContent = "case .bloomFilterExcludedDomains: return URL(string: \"https://staticcdn.duckduckgo.com/https/https-mobile-v2-false-positives.json\")!\r\n";
        appUrlsContent += "case .privacyConfiguration2: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/config/v4/macos-config.json\")!\r\n";
        appUrlsContent += "case .surrogates: return URL(string: \"https://duckduckgo.com/contentblocking.js?l=surrogates\")!\r\n";
        appUrlsContent += "case .trackerDataSet: return URL(string: \"https://staticcdn.duckduckgo.com/trackerblocking/v5/current/macos-tds.json\")!\r\n";
        
        dm.danger.github.utils.fileContents
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent))
            .mockReturnValueOnce(Promise.resolve(appUrlsContent))
            .mockReturnValueOnce(Promise.resolve(updateEmbeddedContent));

        await embeddedFilesURLMismatch()

        expect(dm.fail).toHaveBeenCalledWith("Privacy Config URL mismatch. Please check DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift and scripts/update_embedded.sh")
    })

})