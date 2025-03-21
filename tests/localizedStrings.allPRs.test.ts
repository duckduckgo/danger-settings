jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { localizedStrings } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.message = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "file1.swift",
                "file2.swift"
            ],
        },
        github: {
            pr: {
                additions: 200,
                deletions: 10
            },
            thisPR: {
                repo: "iOS"
            },
        },
    }
})

describe("Localized Strings checks", () => {
    it("does not message with no changes", async () => {
        dm.danger.git.modified_files = []

        await localizedStrings()

        expect(dm.message).not.toHaveBeenCalled()
    })

    it("does not message with no diff", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await localizedStrings()

        expect(dm.message).not.toHaveBeenCalled()
    })

    it("does not message with no additions", async () => {
        await localizedStrings()

        expect(dm.message).not.toHaveBeenCalled()
    })

    it("does not message with added code that doesn't contain NSLocalizedString", async () => {
        dm.addedLines = `
+    fileprivate struct Constants {
+        static let databaseName = "Database"
+    }
+
        `

        await localizedStrings()

        expect(dm.message).not.toHaveBeenCalled()
    })

    it("does not message with added code that mentions NSLocalizedString but doesn't call it", async () => {
        dm.addedLines = `
+    // We're not using NSLocalizedString here.
        `

        await localizedStrings()

        expect(dm.message).not.toHaveBeenCalled()
    })

    it("messages with added code that contains NSLocalizedString call, including iOS Localization guidelines URL when run for iOS repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        dm.addedLines = `
+    let title = NSLocalizedString("title", comment: "Title")
        `

        await localizedStrings()
        
        expect(dm.message).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change. See [iOS](https://app.asana.com/0/0/1185863667140706/f) and [macOS](https://app.asana.com/0/0/1206727265537758/f) localization guidelines for more information.")
    })

    it("messages with added code that contains NSLocalizedString call, including macOS Localization guidelines URL when run for macos-browser repo", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.addedLines = `
+    let title = NSLocalizedString("title", comment: "Title")
        `

        await localizedStrings()
        
        expect(dm.message).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change. See [iOS](https://app.asana.com/0/0/1185863667140706/f) and [macOS](https://app.asana.com/0/0/1206727265537758/f) localization guidelines for more information.")
    })

    it("messages with UserText.swift-style added code, including iOS Localization guidelines URL when run for iOS repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        dm.addedLines = `
+    static let mainMenuAppCheckforUpdates = NSLocalizedString("main-menu.app.check-for-updates", value: "Check for Updates!", comment: "Main Menu DuckDuckGo item")
        `

        await localizedStrings()

        expect(dm.message).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change. See [iOS](https://app.asana.com/0/0/1185863667140706/f) and [macOS](https://app.asana.com/0/0/1206727265537758/f) localization guidelines for more information.")
    })

    it("messages with UserText.swift-style added code, including macOS Localization guidelines URL when run for macos-browser repo", async () => {
        dm.danger.github.thisPR.repo = "macos-browser"
        dm.addedLines = `
+    static let mainMenuAppCheckforUpdates = NSLocalizedString("main-menu.app.check-for-updates", value: "Check for Updates!", comment: "Main Menu DuckDuckGo item")
        `

        await localizedStrings()

        expect(dm.message).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change. See [iOS](https://app.asana.com/0/0/1185863667140706/f) and [macOS](https://app.asana.com/0/0/1206727265537758/f) localization guidelines for more information.")
    })
})
