import {fail, warn, message, danger} from "danger"

export const prSize = async () => {  
    // Define file types to exclude for iOS and macOS projects
    const excludedExtensions = ['.xcodeproj', '.xcassets', '.xcworkspace'];

    // Get all modified and added files (unique)
    const changedFiles = [...new Set([
        ...danger.git.modified_files,
        ...danger.git.created_files
    ])];

    // Filter out excluded file types
    const filesToCheck = changedFiles.filter(file => 
        !excludedExtensions.some(ext => file.includes(ext))
    );

    // If no files to check after filtering, exit early
    if (filesToCheck.length === 0) return;

    // Count additions
    let totalAdditions = 0;
    for (const file of filesToCheck) {
        const diff = await danger.git.diffForFile(file);
        if (diff) {
            totalAdditions += diff.added.split('\n').length - 1;
        }
    }

    // Issue warning if additions exceed 500
    if (totalAdditions >= 500) {
        warn(`PR has ${totalAdditions} lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.`);
    }
}

export const internalLink = async () => {
    const regex = /https:\/\/app.asana.com\/[0-9]\/[0-9]*\/([0-9]*)/

    let hasLink = false;
    // Warn when link to internal task is missing
    for (let bodyLine of danger.github.pr.body.toLowerCase().split(/\n/)) {
        if (bodyLine.includes("task/issue url:")) {

            let match = bodyLine.match(regex);
            if (!match || match.length < 2) {
                fail("Please, don't forget to add a link to the internal task");
                return;
            }

            hasLink = true;
            break;
        }
    }

    if (!hasLink) {
        fail("Please, don't forget to add a link to the internal task");
    }
}

export const xcodeprojConfiguration_macOS = async () => {
    if (danger.github.thisPR.repo == "apple-browsers") {
        const projectFile = "macOS/DuckDuckGo-macOS.xcodeproj/project.pbxproj";
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
                fail("No configuration is allowed inside macOS Xcode project file - use xcconfig files instead.");
            }
        }
    }
}

export const localizedStrings = async () => {
    for (let file of danger.git.modified_files) {
        let diff = await danger.git.diffForFile(file);
        let addedLines = diff?.added.split(/\n/);
        // The regex is equal to:
        // * word boundary
        // * NSLocalizedString(
        // This way it will match `NSLocalizedString(` but not `NSLocalizedString` (without the opening parenthesis, which could be used in a comment).
        if (addedLines?.find(value => /\bNSLocalizedString\(/.test(value))) {
            let instructions = "";
            if (danger.github.thisPR.repo == "iOS") {
                instructions = " See [Localization Guidelines](https://app.asana.com/0/0/1185863667140706/f) for more information.";
            } else if (danger.github.thisPR.repo == "macos-browser") {
                instructions = " See [Localization Guidelines](https://app.asana.com/0/0/1206727265537758/f) for more information.";
            }
            message("You seem to be updating localized strings. Make sure that you request translations and include translated strings before you ship your change." + instructions);
            break;
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
    if (danger.github.thisPR.repo == "apple-browsers") {
        const createdFiles = danger.git.created_files; 
        if (createdFiles.some(path => path.match(/iOS\/DuckDuckGo\/Assets.xcassets\/.*\.colorset/))) {
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

async function trackerBlockingMismatch(modifiedFiles: any) {
    // Fail if Tracker Blocking config URL is different between code and script
    let tdsUrlProviderFileiOSPath = 'iOS/Core/AppURLs.swift';
    let updateEmbeddedFileiOSPath = 'iOS/scripts/update_embedded.sh';
    let tdsUrlProvideriOSRegex = 'static let trackerDataSet = URL.*string:.*staticBase.*trackerblocking\/(.*)\".*';
    let updateEmbeddediOSRegex = 'performUpdate \'https://staticcdn.duckduckgo.com/trackerblocking/(.*)\' \".*';

    let tdsUrlProviderFilemacOSPath = 'macOS/DuckDuckGo/Application/AppConfigurationURLProvider.swift';
    let updateEmbeddedFilemacOSPath = 'macOS/scripts/update_embedded.sh';
    let tdsUrlProvidermacOSRegex = 'public static let defaultTrackerDataURL = URL.string: \"(.*)\".*';
    let updateEmbeddedmacOSRegex = 'TDS_URL=\"(.*)\"';

    const iosResult = await checkForMismatch(modifiedFiles, tdsUrlProviderFileiOSPath, tdsUrlProvideriOSRegex, updateEmbeddedFileiOSPath, updateEmbeddediOSRegex);
    if (iosResult) {
        fail(`iOS Content Tracker URL mismatch. Please check ${tdsUrlProviderFileiOSPath} and ${updateEmbeddedFileiOSPath}`)
    }

    const macosResult = await checkForMismatch(modifiedFiles, tdsUrlProviderFilemacOSPath, tdsUrlProvidermacOSRegex, updateEmbeddedFilemacOSPath, updateEmbeddedmacOSRegex);
    if (macosResult) {
        fail(`macOS Content Tracker URL mismatch. Please check ${tdsUrlProviderFilemacOSPath} and ${updateEmbeddedFilemacOSPath}`)
    }
}

async function privacyConfigMismatch(modifiedFiles: any) {
    // Fail if Tracker Blocking config URL is different between code and script
    let appConfigUrlProviderFileiOSPath = 'iOS/Core/AppURLs.swift';
    let updateEmbeddedFileiOSPath = 'iOS/scripts/update_embedded.sh';
    let configUrlProvideriOSRegex = 'static let privacyConfig = URL.*string:.*staticBase.*trackerblocking\/config\/(.*)\".*';
    let updateEmbeddediOSRegex = 'performUpdate \'https://staticcdn.duckduckgo.com/trackerblocking/config/(.*)\' \".*';

    let appConfigUrlProviderFilemacOSPath = 'macOS/DuckDuckGo/Application/AppConfigurationURLProvider.swift';
    let updateEmbeddedFilemacOSPath = 'macOS/scripts/update_embedded.sh';
    let configUrlProvidermacOSRegex = 'public static let defaultPrivacyConfigurationURL = URL.string: \"(.*)\".*';
    let updateEmbeddedmacOSRegex = 'CONFIG_URL=\"(.*)\"';

    const iosResult = await checkForMismatch(modifiedFiles, appConfigUrlProviderFileiOSPath, configUrlProvideriOSRegex, updateEmbeddedFileiOSPath, updateEmbeddediOSRegex);
    if (iosResult) {
        fail(`iOS Privacy Config URL mismatch. Please check ${appConfigUrlProviderFileiOSPath} and ${updateEmbeddedFileiOSPath}`)
    }

    const macosResult = await checkForMismatch(modifiedFiles, appConfigUrlProviderFilemacOSPath, configUrlProvidermacOSRegex, updateEmbeddedFilemacOSPath, updateEmbeddedmacOSRegex);
    if (macosResult) {
        fail(`macOS Privacy Config URL mismatch. Please check ${appConfigUrlProviderFilemacOSPath} and ${updateEmbeddedFilemacOSPath}`)
    }
}

export const embeddedFilesURLMismatch = async() => {
    const modifiedFiles = danger.git.modified_files;

    await trackerBlockingMismatch(modifiedFiles)
    await privacyConfigMismatch(modifiedFiles)
}

export const releaseAndHotfixBranchBSKChangeWarning = async () => {  
    const branchName = danger.github.pr.head.ref;
    if (!branchName.startsWith('release/') && !branchName.startsWith('hotfix/')) return;

    const changedFiles = [...new Set([
        ...danger.git.modified_files,
        ...danger.git.created_files,
        ...danger.git.deleted_files
    ])];

    const bskFiles = changedFiles.filter(file => file.startsWith('BrowserServicesKit'));
    if (bskFiles.length === 0) return;

    warn(`Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch`);
}

// Default run
export default async () => {
    await prSize()
    await internalLink()
    await xcodeprojConfiguration_macOS()
    await localizedStrings()
    await licensedFonts()
    await newColors()
    await embeddedFilesURLMismatch()
    await releaseAndHotfixBranchBSKChangeWarning()
}
