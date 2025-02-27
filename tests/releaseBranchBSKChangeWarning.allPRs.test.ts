jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { releaseAndHotfixBranchBSKChangeWarning } from '../org/allPRs'

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
    it("does not warn if the branch name does not start with 'release/' or 'hotfix/'", async () => {
        dm.danger.github.pr.head.ref = "feature/unrelated"

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn if no files in 'BrowserServicesKit' are modified", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.modified_files = ["some/other/file.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are modified", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.modified_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are created", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.created_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })

    it("warns if the branch name starts with 'release/' and files in 'BrowserServicesKit' are deleted", async () => {
        dm.danger.github.pr.head.ref = "release/ios/7.123.0"
        dm.danger.git.deleted_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()
        
        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })

    it("warns if the branch name starts with 'hotfix/' and files in 'BrowserServicesKit' are modified", async () => {
        dm.danger.github.pr.head.ref = "hotfix/ios/7.123.1"
        dm.danger.git.modified_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })

    it("warns if the branch name starts with 'hotfix/' and files in 'BrowserServicesKit' are created", async () => {
        dm.danger.github.pr.head.ref = "hotfix/ios/7.123.1"
        dm.danger.git.created_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()

        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })

    it("warns if the branch name starts with 'hotfix/' and files in 'BrowserServicesKit' are deleted", async () => {
        dm.danger.github.pr.head.ref = "hotfix/ios/7.123.1"
        dm.danger.git.deleted_files = ["BrowserServicesKit/SomeFile.swift"]

        await releaseAndHotfixBranchBSKChangeWarning()
        
        expect(dm.warn).toHaveBeenCalledWith("Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch")
    })
})