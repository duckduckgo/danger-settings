jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { remoteReleasableFeatureWarning } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "ModifiedFile.swift"
            ],
            created_files: [
                "CreatedFile.swift"
            ]
        }
    }
})

describe("remoteReleasable(.feature warning", () => {
    it("does not warn with no changes to Swift files", async () => {
        dm.danger.git.modified_files = ["ModifiedFile.m"]
        dm.danger.git.created_files = []

        await remoteReleasableFeatureWarning()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await remoteReleasableFeatureWarning()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with deletions", async () => {
        dm.addedLines = `
-        .remoteReleasable(.feature("example"))
        `

        await remoteReleasableFeatureWarning()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with remoteReleasable(.feature additions", async () => {
        dm.addedLines = `
+        .remoteReleasable(.feature("example"))
        `

        await remoteReleasableFeatureWarning()
        expect(dm.warn).toHaveBeenCalledWith("⚠️ Parent feature flags do not support rollouts - if you wish to use a rollout for your feature, please use a subfeature flag.")
    })
})
