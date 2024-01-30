jest.mock("danger", () => jest.fn())
jest.mock("Asana", () => jest.fn())
import danger from 'danger'
import Asana from 'asana'
const dm = danger as any;
const a = Asana as any;

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

    a.ApiClient = {
        instance: {
            authentications: {
                token: {
                    accessToken: '1234'
                }
            }
        }
    }

    a.TasksApi = jest.fn().mockImplementation(() => {
        return {
            getTask: jest.fn().mockReturnValue({
                data: {
                    projects: [
                        { gid: '1234' },
                        { gid: '0001' },
                    ]
                }
            })
        }
    })
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

    it("does not fail when the description contains a link to Asana task in a correct project", async () => {
        process.env.ASANA_ACCESS_TOKEN = '1234'
        process.env.ASANA_PROJECT_ID = '0001'
        process.env.ASANA_PROJECT_NAME = 'macOS App Board'

        await internalLink();
        
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails when the description contains a link to Asana task not in a correct project", async () => {
        process.env.ASANA_ACCESS_TOKEN = '1234'
        process.env.ASANA_PROJECT_ID = '9999'
        process.env.ASANA_PROJECT_NAME = 'macOS App Board'

        await internalLink();
        
        expect(dm.fail).toHaveBeenCalledWith("Please ensure that the Asana task is added to macOS App Board project")
    })
})
