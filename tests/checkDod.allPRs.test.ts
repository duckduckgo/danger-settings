jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { dodChecked } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        github: {
            pr: {
                body: "",
            }
        },
    }
})

describe("Definition of Done checked", () => {
    it("does fail when Definition of Done checkbox is not in the body", async () => {
        var prBody = "**Steps to test this PR**:\n1.\n2.\n"
        prBody += "**Orientation Testing**:\n* [ ] Portrait\n* [ ] Landscape"
        dm.danger.github.pr.body = prBody

        await dodChecked()
        
        expect(dm.fail).toHaveBeenCalledWith("Please, make sure this PR satisfies our [Definition of Done](https://app.asana.com/0/1202500774821704/1207634633537039/f).")
    })

    it("does fail when Definition of Done checkbox is not checked", async () => {
        var prBody = "**Steps to test this PR**:\n1.\n2.\n"
        prBody += "**Definition of Done (Internal Only)**:\n* [ ] Does this PR satisfy our [Definition of Done](https://app.asana.com/0/1202500774821704/1207634633537039/f)?\n"
        prBody += "**Orientation Testing**:\n* [ ] Portrait\n* [ ] Landscape"
        dm.danger.github.pr.body = prBody

        await dodChecked()
        
        expect(dm.fail).toHaveBeenCalledWith("Please, make sure this PR satisfies our [Definition of Done](https://app.asana.com/0/1202500774821704/1207634633537039/f).")
    })

    it("does not fail when Definition of Done checkbox is checked (Lower Case)", async () => {
        var prBody = "**Steps to test this PR**:\n1.\n2.\n"
        prBody += "**Definition of Done (Internal Only)**:\n* [x] Does this PR satisfy our [Definition of Done](https://app.asana.com/0/1202500774821704/1207634633537039/f)?\n"
        prBody += "**Orientation Testing**:\n* [ ] Portrait\n* [ ] Landscape"
        dm.danger.github.pr.body = prBody

        await dodChecked()
        
        expect(dm.fail).not.toHaveBeenCalledWith()
    })

    it("does not fail when Definition of Done checkbox is checked (Upper Case)", async () => {
        var prBody = "**Steps to test this PR**:\n1.\n2.\n"
        prBody += "**Definition of Done (Internal Only)**:\n* [X] Does this PR satisfy our [Definition of Done](https://app.asana.com/0/1202500774821704/1207634633537039/f)?\n"
        prBody += "**Orientation Testing**:\n* [ ] Portrait\n* [ ] Landscape"
        dm.danger.github.pr.body = prBody

        await dodChecked()
        
        expect(dm.fail).not.toHaveBeenCalledWith()
    })
})
