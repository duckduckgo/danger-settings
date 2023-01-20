jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { xcodeprojConfiguration } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
        },
        github: {
            pr: {
                additions: 200,
                deletions: 10,
                repo: "macos-browser"
            }
        },
    }
})

describe("Xcode project file configuration checks", () => {
    it("does not fail with no changes to project file", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await xcodeprojConfiguration()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {

        await xcodeprojConfiguration()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with added source file", async () => {
        dm.addedLines = `
        +		372C27BE297AD5C200C758EB /* Test.swift in Sources */ = {isa = PBXBuildFile; fileRef = 372C27BD297AD5C200C758EB /* Test.swift */; };
        +		372C27BD297AD5C200C758EB /* Test.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Test.swift; sourceTree = "<group>"; };
        +				372C27BD297AD5C200C758EB /* Test.swift */,
        +				372C27BE297AD5C200C758EB /* Test.swift in Sources */,
        `

        await xcodeprojConfiguration()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with added configuration", async () => {
        dm.addedLines = `
        +				ALLOW_TARGET_PLATFORM_SPECIALIZATION = YES;
        `

        await xcodeprojConfiguration()
        
        expect(dm.fail).toHaveBeenCalledWith("No configuration is allowed inside Xcode project file - use xcconfig files instead.")
    })

    it("fails with added configuration with empty value", async () => {
        dm.addedLines = `
        +				CODE_SIGN_IDENTITY = ;
        `

        await xcodeprojConfiguration()
        
        expect(dm.fail).toHaveBeenCalledWith("No configuration is allowed inside Xcode project file - use xcconfig files instead.")
    })

    it("fails with added configuration with key containing digits", async () => {
        dm.addedLines = `
        +				GCC_WARN_64_TO_32_BIT_CONVERSION = YES_ERROR;
        `

        await xcodeprojConfiguration()
        
        expect(dm.fail).toHaveBeenCalledWith("No configuration is allowed inside Xcode project file - use xcconfig files instead.")
    })

    it("does not fail with added cofiguration in non-macos app repo", async () => {
        dm.danger.github.pr.repo = "iOS"
        dm.addedLines = `
        +				GCC_WARN_64_TO_32_BIT_CONVERSION = YES_ERROR;
        `

        await xcodeprojConfiguration()

        expect(dm.fail).not.toHaveBeenCalled()
    })
})


