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
            fail("Please, don't forget to add a link to the internal task");
        }
    }
}

export const xcodeprojConfiguration = async () => {
    if (danger.github.thisPR.repo == "macos-browser") {
        const projectFile = "DuckDuckGo.xcodeproj/project.pbxproj";
        if (danger.git.modified_files.includes(projectFile)) {
            let diff = await danger.git.diffForFile(projectFile);
            let addedLines = diff?.added.split(/\n/);
            // The regex is equal to:
            // * plus sign
            // * 1 or more tabulation keys
            // * an identifier (key) consisting of capital letters, underscores and digits,
            // * a space and an equality sign
            // * arbitrary number of any characters (the value can be empty)
            // * a semicolon
            if (addedLines?.find(value => /^\+\t+[A-Z_0-9]* =.*;$/.test(value))) {
                fail("No configuration is allowed inside Xcode project file - use xcconfig files instead.");
            }
        }
    }
}

export const licensedFonts = async () => {
    // Fail if licensed fonts are committed
    const modifiedFiles = danger.git.modified_files; 
    if (modifiedFiles.some(path => path.match(/fonts\/licensed\/.*\.otf/))) {
        fail("Licensed fonts shouldn't be commited to this repository.")
    }
}

export const newColors = async () => {
    // Fail if new colors are added to the app (DesignResourcesKit)
    if (danger.github.thisPR.repo == "iOS") {
        const createdFiles = danger.git.created_files; 
        if (createdFiles.some(path => path.match(/Assets.xcassets\/.*\.colorset/))) {
            fail("DesignResourcesKit: No new colors should be added to this app.")
        }
    }
}

async function extractUrl(filePath: string, regex: string, matchGroup: any): Promise<string> {
    const fileContents = await danger.github.utils.fileContents(filePath);
    var fileMatch = fileContents.match(regex);
    var extractedUrl = '';
    if (Array.isArray(fileMatch) && fileMatch.length > matchGroup) {
        extractedUrl = fileMatch[matchGroup];
    }

    return extractedUrl;
}

async function checkForMismatch(modifiedFiles: any, sourceCodeUrlFilePath: string, sourceCodeUrlRegex: string, scriptFilePath: string, scriptRegex: string) {
    const embeddedUrlFiles = [sourceCodeUrlFilePath, scriptFilePath];
    
    // Run tests
    if (modifiedFiles.some(path => embeddedUrlFiles.includes(path))) {
        var sourceCodeFileContentsUrl = await extractUrl(sourceCodeUrlFilePath, sourceCodeUrlRegex, 1);
        var scriptContentsUrl = await extractUrl(scriptFilePath, scriptRegex, 1);

        return (sourceCodeFileContentsUrl != scriptContentsUrl);
    }

    return false;
}

async function trackerBlockingMismatch(repository: string, modifiedFiles: any) {
    // Fail if Tracker Blocking config URL is different between code and script
    var tdsUrlProviderFilePath = ''; 
    var updateEmbeddedFilePath = ''; 
    var tdsUrlProviderRegex = '';
    var updateEmbeddedRegex = '';

    // Configure
    switch (repository) {
        case "iOS":
            tdsUrlProviderFilePath = 'Core/AppURLs.swift';
            updateEmbeddedFilePath = 'scripts/update_embedded.sh';

            tdsUrlProviderRegex = 'static let trackerDataSet = URL.*string:.*staticBase.*trackerblocking\/(.*)\".*';
            updateEmbeddedRegex = 'performUpdate \'https://staticcdn.duckduckgo.com/trackerblocking/(.*)\' \".*';
            break;
        case "macos-browser":
            return;
        default:
            return;
    } 

    const res = await checkForMismatch(modifiedFiles, tdsUrlProviderFilePath, tdsUrlProviderRegex, updateEmbeddedFilePath, updateEmbeddedRegex);
    if (res) {
        fail(`Content Tracker URL mismatch. Please check ${tdsUrlProviderFilePath} and ${updateEmbeddedFilePath}`)
    }
}

async function privacyConfigMismatch (repository: string, modifiedFiles: any) {
    // Fail if Tracker Blocking config URL is different between code and script
    var appConfigUrlProviderFilePath = ''; 
    var updateEmbeddedFilePath = ''; 
    var configUrlProviderRegex = '';
    var updateEmbeddedRegex = '';

    // Configure
    switch (repository) {
        case "iOS":
            return;
        case "macos-browser":
            appConfigUrlProviderFilePath = 'DuckDuckGo/AppDelegate/AppConfigurationURLProvider.swift';
            updateEmbeddedFilePath = 'scripts/update_embedded.sh';

            configUrlProviderRegex = 'case \.privacyConfiguration: return URL.string: \"(.*)\".*';
            updateEmbeddedRegex = 'CONFIG_URL=\"(.*)\"';
            break;
        default:
            return;
    } 

    const res = await checkForMismatch(modifiedFiles, appConfigUrlProviderFilePath, configUrlProviderRegex, updateEmbeddedFilePath, updateEmbeddedRegex);
    if (res) {
        fail(`Privacy Config URL mismatch. Please check ${appConfigUrlProviderFilePath} and ${updateEmbeddedFilePath}`)
    }
}

export const embeddedFilesURLMismatch = async() => {
    const repo = danger.github.thisPR.repo;
    const modifiedFiles = danger.git.modified_files;

    await trackerBlockingMismatch(repo, modifiedFiles)
    await privacyConfigMismatch(repo, modifiedFiles)
}

// Default run
export default async () => {
    await prSize()
    await internalLink()
    await xcodeprojConfiguration()
    await licensedFonts()
    await newColors()
    await embeddedFilesURLMismatch()
}
