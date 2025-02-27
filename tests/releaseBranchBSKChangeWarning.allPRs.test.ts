jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { releaseBranchBSKChangeWarning } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            modified_files: [],
            created_files: [],
            deleted_files: [],
        },
        github: {
            pr: {
                head: {
                    ref: ""
                }
            },
            thisPR: {
                repo: "apple-browsers"
            },
            utils: {
                fileContents: jest.fn(),
            }
        },
    };

    dm.danger.github.utils.fileContents.mockReturnValue(Promise.resolve(""));
})

describe("releaseBranchBSKChangeWarning", () => {
    it("does not warn if the branch name does not start with 'release/'", async () => {
        dm.danger.github.pr.head.ref = "feature/unrelated"

        await releaseBranchBSKChangeWarning()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn if no files in 'BrowserServicesKit' are modified", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.modified_files = ["some/other/file.swift"]

        await releaseBranchBSKChangeWarning()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are modified", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.modified_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this release branch need to be merged to the other platform's release branch")
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are created", async () => {
        dm.danger.github.pr.head.ref = "release/1.0.0"
        dm.danger.git.created_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this release branch need to be merged to the other platform's release branch")
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are deleted", async () => {
        dm.danger.github.pr.head.ref = "release/1.0.0"
        dm.danger.git.deleted_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseBranchBSKChangeWarning()
        
        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this release branch need to be merged to the other platform's release branch")
    })
})