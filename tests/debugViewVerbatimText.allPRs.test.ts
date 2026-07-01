jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { debugViewVerbatimText as debugViewVerbatimText } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "Debug/DebugView.swift"
            ],
            created_files: []
        }
    }
})

describe("Debug view Text() checks", () => {
    it("does not warn when no debug files are changed", async () => {
        dm.danger.git.modified_files = ["SomeFeatureView.swift"]
        dm.danger.git.created_files = []

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when no diff in debug files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no additions", async () => {
        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when Text(verbatim:) is used", async () => {
        dm.addedLines = `
+           Text(verbatim: "Debug only label")
        `

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out Text(\"\")", async () => {
        dm.addedLines = `
+           // Text("This is commented out")
        `

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for Text with a variable argument", async () => {
        dm.addedLines = `
+           Text(someVariable)
        `

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when Text(\"...\") is added in a debug file", async () => {
        dm.addedLines = `
+           Text("Debug label")
        `

        await debugViewVerbatimText()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when Text(\"...\") is added in a created debug file (Prefix)", async () => {
        dm.danger.git.modified_files = []
        dm.danger.git.created_files = ["Features/DebugMenuView.swift"]
        dm.addedLines = `
+           Text("Some debug string")
        `

        await debugViewVerbatimText()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when Text(\"...\") is added in a created debug file (Middle)", async () => {
        dm.danger.git.modified_files = []
        dm.danger.git.created_files = ["Features/MenuDebugView.swift"]
        dm.addedLines = `
+           Text("Some debug string")
        `

        await debugViewVerbatimText()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when Text(\"...\") is added in a created debug file (Folder)", async () => {
        dm.danger.git.modified_files = []
        dm.danger.git.created_files = ["Debug/MenuView.swift"]
        dm.addedLines = `
+           Text("Some debug string")
        `

        await debugViewVerbatimText()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not warn for Text(\"...\") in non-debug Swift files", async () => {
        dm.danger.git.modified_files = ["Features/HomeView.swift"]
        dm.danger.git.created_files = []
        dm.addedLines = `
+           Text("Hello world")
        `

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed Text(\"...\") lines in debug files", async () => {
        dm.addedLines = `
-           Text("Removed debug label")
        `

        await debugViewVerbatimText()
        expect(dm.warn).not.toHaveBeenCalled()
    })
})
