import {prSize, internalLink} from "./allPRs"
import {fail, danger} from "danger"

export const xcodeprojConfiguration = async () => {
    const projectFile = "DuckDuckGo.xcodeproj/project.pbxproj";
    if (danger.git.modified_files.includes(projectFile)) {
        let diff = await danger.git.diffForFile(projectFile);
        let addedLines = diff.added.split(/\n/);
        if (addedLines.find(value => /^\+\t+[A-Z_0-9]* = .*;$/i.test(value))) {
            fail("No configuration is allowed inside Xcode project file - use xcconfig files instead.");
        }
    }
}

export default async () => {
    await prSize()
    await internalLink()
    await xcodeprojConfiguration()
}