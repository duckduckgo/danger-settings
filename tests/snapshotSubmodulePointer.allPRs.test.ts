jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { snapshotSubmodulePointer } from '../org/allPRs'

const pointerDiff = (oldSha: string, newSha: string) => ({
    added: `+Subproject commit ${newSha}`,
    removed: `-Subproject commit ${oldSha}`
})

beforeEach(() => {
    dm.fail = jest.fn().mockReturnValue(true);
    dm.warn = jest.fn().mockReturnValue(true);
    dm.message = jest.fn().mockReturnValue(true);

    dm.compareCommits = jest.fn();

    dm.danger = {
        git: {
            diffForFile: async (filename) => {
                if (filename.includes("SnapshotReferences")) {
                    return pointerDiff("a".repeat(40), "b".repeat(40))
                }
                return undefined
            },
            modified_files: [
                "iOS/SnapshotReferences"
            ],
            created_files: []
        },
        github: {
            thisPR: {
                repo: "apple-browsers"
            },
            api: {
                repos: {
                    compareCommits: (...args) => dm.compareCommits(...args)
                }
            }
        },
    }
})

describe("snapshot submodule pointer checks", () => {
    it("does nothing outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"

        await snapshotSubmodulePointer()
        expect(dm.compareCommits).not.toHaveBeenCalled()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.message).not.toHaveBeenCalled()
    })

    it("stays silent when the submodule pointer is unchanged", async () => {
        dm.danger.git.modified_files = ["iOS/DuckDuckGo/SomeFeature.swift"]

        await snapshotSubmodulePointer()
        expect(dm.compareCommits).not.toHaveBeenCalled()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.warn).not.toHaveBeenCalled()
        expect(dm.message).not.toHaveBeenCalled()
    })

    it("stays silent when the changed submodule file is not a gitlink change", async () => {
        dm.danger.git.diffForFile = async (_filename) => ({
            added: "+some unrelated line",
            removed: ""
        })

        await snapshotSubmodulePointer()
        expect(dm.compareCommits).not.toHaveBeenCalled()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.message).not.toHaveBeenCalled()
    })

    it("passes when the new commit is already on submodule main", async () => {
        dm.compareCommits.mockResolvedValue({ data: { status: "behind" } })

        await snapshotSubmodulePointer()
        expect(dm.compareCommits).toHaveBeenCalledWith({
            owner: "duckduckgo",
            repo: "apple-browsers-snapshots",
            base: "main",
            head: "b".repeat(40)
        })
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.warn).not.toHaveBeenCalled()
        expect(dm.message).toHaveBeenCalledTimes(1)
    })

    it("passes when the new commit is identical to submodule main", async () => {
        dm.compareCommits.mockResolvedValue({ data: { status: "identical" } })

        await snapshotSubmodulePointer()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.message).toHaveBeenCalledTimes(1)
    })

    it("fails and nudges for the merge-snapshots label when the commit is on a branch but not main", async () => {
        dm.compareCommits.mockResolvedValue({ data: { status: "ahead" } })

        await snapshotSubmodulePointer()
        expect(dm.message).not.toHaveBeenCalled()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("merge-snapshots")
        expect(failMessage).toContain("not yet merged")
    })

    it("fails when the commit has diverged from main", async () => {
        dm.compareCommits.mockResolvedValue({ data: { status: "diverged" } })

        await snapshotSubmodulePointer()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("merge-snapshots")
    })

    it("fails and points to the script when the commit is not on the remote", async () => {
        dm.compareCommits.mockRejectedValue({ status: 404 })

        await snapshotSubmodulePointer()
        expect(dm.message).not.toHaveBeenCalled()
        expect(dm.fail).toHaveBeenCalledTimes(1)
        const failMessage = dm.fail.mock.calls[0][0] as string
        expect(failMessage).toContain("scripts/open-snapshot-submodule-pr.sh")
        expect(failMessage).toContain("isn't on")
    })

    it("warns (does not fail) when the remote can't be reached", async () => {
        dm.compareCommits.mockRejectedValue({ status: 500, message: "Server Error" })

        await snapshotSubmodulePointer()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const warnMessage = dm.warn.mock.calls[0][0] as string
        expect(warnMessage).toContain("Couldn't verify")
    })
})
