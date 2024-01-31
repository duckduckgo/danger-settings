jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { internalLink } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        github: {
            pr: {
                body: 'task/issue url: https://app.asana.com/0/0001/0002/f'
            }
        },
    }
})

describe("Internal Asana link test", () => {
    it("does not fail when the description contains a link to Asana", async () => {
        await internalLink()
        
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails when the description doesn't contain a link to Asana", async () => {
        dm.danger.github.pr.body = 'task/issue url:' 

        await internalLink();
        
        expect(dm.fail).toHaveBeenCalledWith("Please, don't forget to add a link to the internal task")
    })

    it("fails when the description contains a malformed link to Asana", async () => {
        dm.danger.github.pr.body = 'task/issue url: https://app.asana.com/000010002/f' 

        await internalLink();
        
        expect(dm.fail).toHaveBeenCalledWith("Please, don't forget to add a link to the internal task")
    })

    it("fails when the description doesn't contain a line with task/issue URL", async () => {
        dm.danger.github.pr.body = 'sample random body'

        await internalLink();
        
        expect(dm.fail).toHaveBeenCalledWith("Please, don't forget to add a link to the internal task")
    })
})
