jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { prSize } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        github: {
            pr: {
                additions: 200,
                deletions: 10  
            }
        },
    }
})

describe("PR diff size checks", () => {
    it("does not warn with less than 500 lines", async () => {
        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with more than 500 lines", async () => {
        dm.danger.github.pr.deletions = 301

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has more than 500 lines of code changing. Consider splitting into smaller PRs if possible.')
    })
})


