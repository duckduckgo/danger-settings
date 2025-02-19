jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { prSize } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        github: {
            pr: {
                additions: 200
            }
        },
        git: {
            modified_files: ['src/some/file.ts']
        }
    }
})

describe("PR diff size checks", () => {
    it("does not warn with less than 500 added lines", async () => {
        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with 500 or more added lines in non-excluded files", async () => {
        dm.danger.github.pr.additions = 500
        dm.danger.git.modified_files = ['src/some/file.ts']

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has 500 or more lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.')
    })

    it("does not warn when all modified files are excluded", async () => {
        dm.danger.github.pr.additions = 1000
        dm.danger.git.modified_files = [
            'Project.xcodeproj/something',
            'Assets.xcassets/image.png',
            'Project.xcworkspace/contents'
        ]

        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
    })
})


