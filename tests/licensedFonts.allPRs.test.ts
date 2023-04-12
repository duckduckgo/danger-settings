jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { licensedFonts } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            modified_files: [],
            created_files: [],
            deleted_files: [],
        },
    };
})

describe("Licensed fonts checks", () => {
    it("does not fail with no changed files", async () => {
        dm.danger.git.modified_files = []

        await licensedFonts()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with changes to other files", async () => {
        dm.danger.git.modified_files = ["appStoreExportOptions.plist", "Core/AppConfigurationURLProvider.swift"]

        await licensedFonts()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with changes to licensed fonts", async () => {
        dm.danger.git.modified_files = ["appStoreExportOptions.plist", "Core/AppConfigurationURLProvider.swift", "fonts/licensed/proximanova-bold.otf"]

        await licensedFonts()

        expect(dm.fail).toHaveBeenCalledWith("Licensed fonts shouldn't be commited to this repository.")
    })

    it("fails with changes only to licensed fonts", async () => {
        dm.danger.git.modified_files = ["/fonts/licensed/proximanova-bold.otf"]

        await licensedFonts()

        expect(dm.fail).toHaveBeenCalledWith("Licensed fonts shouldn't be commited to this repository.")
    })

})