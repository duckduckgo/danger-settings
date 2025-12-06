jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { prTitle } from '../org/allPRs'

beforeEach(() => {
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        github: {
            pr: {
                title: "",
                base: {
                    ref: ""
                }
            },
            thisPR: {
                repo: "apple-browsers"
            }
        }
    }
})

describe("PR title checks", () => {
    it("does not run for non-Apple Browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS";

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not run if the target branch is not main", async () => {
        dm.danger.github.pr.base.ref = "feature/unrelated"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });
    
    it("does not fail with a valid PR title starting with '[iOS]' targeting main branch", async () => {
        dm.danger.github.pr.title = "[iOS] Add new feature";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[iOS]' targeting release branch", async () => {
        dm.danger.github.pr.title = "[iOS] Add new feature";
        dm.danger.github.pr.base.ref = "release/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[iOS]' targeting hotfix branch", async () => {
        dm.danger.github.pr.title = "[iOS] Add new feature";
        dm.danger.github.pr.base.ref = "hotfix/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[macOS]' targeting main branch", async () => {
        dm.danger.github.pr.title = "[macOS] Add new feature";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[macOS]' targeting release branch", async () => {
        dm.danger.github.pr.title = "[macOS] Add new feature";
        dm.danger.github.pr.base.ref = "release/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[macOS]' targeting hotfix branch", async () => {
        dm.danger.github.pr.title = "[macOS] Add new feature";
        dm.danger.github.pr.base.ref = "hotfix/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[iOS/macOS]' targeting main branch", async () => {
        dm.danger.github.pr.title = "[iOS/macOS] Add new feature";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[iOS/macOS]' targeting release branch", async () => {
        dm.danger.github.pr.title = "[iOS/macOS] Add new feature";
        dm.danger.github.pr.base.ref = "release/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[iOS/macOS]' targeting hotfix branch", async () => {
        dm.danger.github.pr.title = "[iOS/macOS] Add new feature";
        dm.danger.github.pr.base.ref = "hotfix/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[CI]' targeting main branch", async () => {
        dm.danger.github.pr.title = "[CI] Update CI pipeline";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[CI]' targeting release branch", async () => {
        dm.danger.github.pr.title = "[CI] Update CI pipeline";
        dm.danger.github.pr.base.ref = "release/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("does not fail with a valid PR title starting with '[CI]' targeting hotfix branch", async () => {
        dm.danger.github.pr.title = "[CI] Update CI pipeline";
        dm.danger.github.pr.base.ref = "hotfix/ios/1.0.0"

        await prTitle();

        expect(dm.fail).not.toHaveBeenCalled();
    });

    it("fails with an invalid PR title not starting with '[iOS]'", async () => {
        dm.danger.github.pr.title = "Add new feature for iOS";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).toHaveBeenCalledWith("PR title must start with one of the following prefixes: [iOS], [macOS], [iOS/macOS], [CI]");
    });

    it("fails with an invalid PR title not starting with '[macOS]'", async () => {
        dm.danger.github.pr.title = "macOS: Add new feature";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).toHaveBeenCalledWith("PR title must start with one of the following prefixes: [iOS], [macOS], [iOS/macOS], [CI]");
    });

    it("fails with an invalid PR title not starting with '[iOS/macOS]'", async () => {
        dm.danger.github.pr.title = "Add new feature for iOS and macOS";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).toHaveBeenCalledWith("PR title must start with one of the following prefixes: [iOS], [macOS], [iOS/macOS], [CI]");
    });

    it("fails with an invalid PR title not starting with '[CI]'", async () => {
        dm.danger.github.pr.title = "Add new feature GitHub workflow for CI";
        dm.danger.github.pr.base.ref = "main"

        await prTitle();

        expect(dm.fail).toHaveBeenCalledWith("PR title must start with one of the following prefixes: [iOS], [macOS], [iOS/macOS], [CI]");
    });
    
});