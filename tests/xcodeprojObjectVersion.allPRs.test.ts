jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { xcodeprojObjectVersion_macOS } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "macOS/DuckDuckGo-macOS.xcodeproj/project.pbxproj"
            ]
        },
        github: {
            pr: {
                additions: 200,
                deletions: 10
            },
            thisPR: {
                repo: "apple-browsers"
            }
        },
    }
})

describe("Xcode project file configuration checks", () => {
    it("does not fail with no changes to project file", async () => {
        dm.danger.git.modified_files = []

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no diff in project file", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with added source file", async () => {
        dm.addedLines = `
+		372C27BE297AD5C200C758EB /* Test.swift in Sources */ = {isa = PBXBuildFile; fileRef = 372C27BD297AD5C200C758EB /* Test.swift */; };
+		372C27BD297AD5C200C758EB /* Test.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Test.swift; sourceTree = "<group>"; };
+				372C27BD297AD5C200C758EB /* Test.swift */,
+				372C27BE297AD5C200C758EB /* Test.swift in Sources */,
        `

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with objectVersion change to 60", async () => {
        dm.addedLines = `
+		objectVersion = 60;
        `

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with objectVersion change to a number lower than 60", async () => {
        dm.addedLines = `
+		objectVersion = 55;
        `

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with objectVersion change to a number greater than 60", async () => {
        dm.addedLines = `
+		objectVersion = 70;
        `

        await xcodeprojObjectVersion_macOS()

        expect(dm.fail).toHaveBeenCalledWith("macOS Xcode project file needs to keep objectVersion at 60 - you may have added a buildable folder reference to the project file. Please replace it with a file group.")
    })
})
