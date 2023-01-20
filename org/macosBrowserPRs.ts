import {fail, warn, danger} from "danger"

export const prSize = async () => {
    // Warn when there is a big PR
    if (danger.github.pr.additions + danger.github.pr.deletions > 500) {
        warn("PR has more than 500 lines of code changing. Consider splitting into smaller PRs if possible.");
    }
}

export const internalLink = async () => {
    // Warn when link to internal task is missing
    for (let bodyLine of danger.github.pr.body.toLowerCase().split(/\n/)) {
        if (bodyLine.includes("task/issue url:") && (!bodyLine.includes("app.asana.com"))) {
            warn("Please, don't forget to add a link to the internal task");
        }
    }
}

export const xcodeprojConfiguration = async () => {
    const projectFile = "DuckDuckGo.xcodeproj/project.pbxproj";
    if (danger.git.modified_files.includes(projectFile)) {
        let diff = await danger.git.diffForFile(projectFile);
        let addedLines = diff.added.split(/\n/);
        // The regex is equal to:
        // * plus sign
        // * 1 or more tabulation keys
        // * an identifier (key) consisting of capital letters, underscores and digits,
        // * a space and an equality sign
        // * arbitrary number of any characters (the value can be empty)
        // * a semicolon
        if (addedLines.find(value => /^\+\t+[A-Z_0-9]* =.*;$/i.test(value))) {
            fail("No configuration is allowed inside Xcode project file - use xcconfig files instead.");
        }
    }
}

export default async () => {
    await prSize()
    await internalLink()
    await xcodeprojConfiguration()
}