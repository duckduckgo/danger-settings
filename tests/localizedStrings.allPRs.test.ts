jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { localizedStrings } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

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
        },
    }
})

describe("Localized Strings checks", () => {
    it("does not warn with no changes", async () => {
        dm.danger.git.modified_files = []

        await localizedStrings()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await localizedStrings()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await localizedStrings()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with added code that doesn't contain NSLocalizedString", async () => {
        dm.addedLines = `
+    fileprivate struct Constants {
+        static let databaseName = "Database"
+    }
+
        `

        await localizedStrings()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with added code that mentions NSLocalizedString but doesn't call it", async () => {
        dm.addedLines = `
+    // We're not using NSLocalizedString here.
        `

        await localizedStrings()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with added code that contains NSLocalizedString call", async () => {
        dm.addedLines = `
+    let title = NSLocalizedString("title", comment: "Title")
        `

        await localizedStrings()
        
        expect(dm.warn).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change.")
    })

    it("warns with UserText.swift-style added code", async () => {
        dm.addedLines = `
+    static let mainMenuAppCheckforUpdates = NSLocalizedString("main-menu.app.check-for-updates", value: "Check for Updates!", comment: "Main Menu DuckDuckGo item")
        `

        await localizedStrings()

        expect(dm.warn).toHaveBeenCalledWith("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change.")
    })
})
