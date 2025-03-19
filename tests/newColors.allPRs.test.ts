jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { newColors } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            modified_files: ["iOS/Core/AppConfigurationURLProvider.swift"],
            created_files: [],
            deleted_files: [],
        },
        github: {
            thisPR: {
                repo: "apple-browsers"
            }
        },
    };
})

describe("New colors checks", () => {
    it("does not fail with no created files", async () => {
        dm.danger.git.modified_files = []

        await newColors()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with changes to colorset files", async () => {
        dm.danger.git.modified_files = ["iOS/DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "iOS/Core/AppConfigurationURLProvider.swift"]

        await newColors()

        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with new colorset file", async () => {
        dm.danger.git.created_files = ["iOS/DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json", "iOS/Core/AppConfigurationURLProvider.swift"]

        await newColors()

        expect(dm.fail).toHaveBeenCalledWith("DesignResourcesKit: No new colors should be added to this app.")
    })

    it("does not fail in the macOS client", async () => {
        dm.danger.git.created_files = ["macOS/DuckDuckGo/Assets.xcassets/SomeColor.colorset/Contents.json"]

        await newColors()

        expect(dm.fail).not.toHaveBeenCalled()
    })

})