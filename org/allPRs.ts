import {fail, warn, message, danger} from "danger"

export const prSize = async () => {
    // Define file types to exclude for iOS and macOS projects
    const excludedExtensions = ['.xcodeproj', '.xcassets', '.xcworkspace'];

    // Get all modified and added files (unique)
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ];

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

export const xcodeprojObjectVersion_macOS = async () => {
    const projectFile = "macOS/DuckDuckGo-macOS.xcodeproj/project.pbxproj";
    if (danger.git.modified_files.includes(projectFile)) {
        let diff = await danger.git.diffForFile(projectFile);
        let addedLines = diff?.added.split(/\n/);
        // The regex is equal to:
        // * plus sign
        // * 1 or more tabulation keys
        // * `objectVersion` identifier (key)
        // * a space, an equality sign and a space
        // * a number
        // * a semicolon
        //
        // We're capturing the number and if it's greater than 60 (the max supported objectVersion), we fail the check.
        //
        // NOTE: We should remove this check once we're able to use buildable folders in the macOS Xcode project file.
        //
        const objectVersionMatch = addedLines?.find(value => {
            const match = value.match(/^\+\t+objectVersion = ([0-9]+);$/);
            console.log(value, match);
            return match && parseInt(match[1]) > 60;
        });
        if (objectVersionMatch) {
            fail("macOS Xcode project file needs to keep objectVersion at 60 - you may have added a buildable folder reference to the project file. Please replace it with a file group.");
        }
    }
}

export const singletons = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.endsWith(".swift"));

    for (const file of changedFiles) {
        let diff = await danger.git.diffForFile(file);
        let addedLines = diff?.added.split(/\n/);
        const foundSingleton = addedLines?.find(value => /^\+(?!\s*\/\/)\s*(?:public|private|internal)?\s*static\s*(?:let|var)\s*shared(?:\s*:.+)?\s*=.*$/.test(value));
        if (foundSingleton) {
            // trim leading + and whitespace
            const cleanLine = foundSingleton.replace(/^\+\s*/, '').trim();
            fail(`New singleton definitions are not allowed. Found this line:\n\`\`\`swift\n${cleanLine}\n\`\`\``);
            return;
        }
    }
}

export const userDefaultsWrapper = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.endsWith(".swift"));

    for (const file of changedFiles) {
        let diff = await danger.git.diffForFile(file);
        let addedLines = diff?.added.split(/\n/);
        const foundOccurrence = addedLines?.find(value => /^\+(?!\s*\/\/)\s*@UserDefaultsWrapper(?:\((?:.*\))?)?$/.test(value));
        if (foundOccurrence) {
            // trim leading + and whitespace
            const cleanLine = foundOccurrence.replace(/^\+\s*/, '').trim();
            fail(`New \`@UserDefaultsWrapper\` definitions are not allowed. Please use \`KeyedStoring\` protocol instead.\nFound this line:\n\`\`\`swift\n${cleanLine}\n\`\`\``);
            return;
        }
    }
}

export const remoteReleasableFeatureWarning = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.endsWith(".swift"));

    for (const file of changedFiles) {
        let diff = await danger.git.diffForFile(file);
        let addedLines = diff?.added.split(/\n/);
        if (addedLines?.find(value => value.startsWith("+") && value.includes(".remoteReleasable(.feature"))) {
            warn("⚠️ Parent feature flags do not support rollouts - if you wish to use a rollout for your feature, please use a subfeature flag.");
            return;
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
            let instructions = " See [iOS](https://app.asana.com/0/0/1185863667140706/f) and [macOS](https://app.asana.com/0/0/1206727265537758/f) localization guidelines for more information.";
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

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files,
        ...danger.git.deleted_files
    ];

    const bskFiles = changedFiles.filter(file => file.startsWith('BrowserServicesKit'));
    if (bskFiles.length === 0) return;

    warn(`Please check whether the BSK changes on this branch need to be merged to the other platform's release/hotfix branch`);
}

export const featureFlagAsanaLink = async () => {
    const featureFlagFilePattern = /^(iOS|macOS)\/.*\/FeatureFlag\.swift$/;

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => featureFlagFilePattern.test(file));

    if (changedFiles.length === 0) return;

    const asanaTaskUrlRegex = /^\/\/\/\s*https:\/\/app\.asana\.com\/1\/137249556945\/project\/1211834678943996\/task\/\d+(\?\S*)?\s*$/;
    const casesWithInvalidLinks: { file: string; caseName: string }[] = [];

    for (const file of changedFiles) {
        const structuredDiff = await danger.git.structuredDiffForFile(file);
        if (!structuredDiff) continue;

        for (const chunk of structuredDiff.chunks) {
            let insideFeatureFlagEnum = false;
            let braceDepth = 0;

            // Check if the hunk header context mentions FeatureFlag enum
            if (/enum\s+FeatureFlag\b/.test(chunk.content)) {
                insideFeatureFlagEnum = true;
                braceDepth = 1;
            }

            const changes = chunk.changes;

            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];

                // Skip removed lines – they don't exist in the new file
                if (change.type === "del") continue;

                const content = change.content.length > 0 ? change.content.substring(1) : "";

                // Track enum FeatureFlag declaration
                if (/\benum\s+FeatureFlag\b/.test(content)) {
                    insideFeatureFlagEnum = true;
                    braceDepth = 0;
                }

                // Track brace depth when inside FeatureFlag enum
                if (insideFeatureFlagEnum) {
                    braceDepth += (content.match(/{/g) || []).length;
                    braceDepth -= (content.match(/}/g) || []).length;

                    if (braceDepth <= 0) {
                        insideFeatureFlagEnum = false;
                        continue;
                    }
                }

                if (!insideFeatureFlagEnum) continue;

                // Only check added lines for new case declarations
                if (change.type !== "add") continue;
                const caseMatch = content.match(/^\s*case\s+(\w+)/);
                if (!caseMatch) continue;

                // Found an added case line – walk upward through added comment lines looking for the Asana URL
                let foundAsanaLink = false;
                for (let j = i - 1; j >= 0; j--) {
                    const prevChange = changes[j];
                    if (prevChange.type !== "add") break;
                    const prevContent = prevChange.content.substring(1).trim();
                    if (!prevContent.startsWith("///")) break;
                    if (asanaTaskUrlRegex.test(prevContent)) {
                        foundAsanaLink = true;
                        break;
                    }
                }

                if (!foundAsanaLink) {
                    casesWithInvalidLinks.push({ file, caseName: caseMatch[1] });
                }
            }
        }
    }

    if (casesWithInvalidLinks.length > 0) {
        const caseList = casesWithInvalidLinks.map(c => `- \`${c.caseName}\` in \`${c.file}\``).join("\n");
        warn(`New FeatureFlag cases are missing a valid Feature Flag link in the comment:\n${caseList}\n\nAdd a task in the [Feature Flags project](https://app.asana.com/1/137249556945/project/1211834678943996/list/1211838475578067) and use it in the comment.\nExpected format: \`/// https://app.asana.com/1/137249556945/project/1211834678943996/task/<task_id>\``);
    }
}

export const subscriptionFunnelOriginAsanaLink = async () => {
    const funnelOriginFiles = [
        "iOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift",
        "macOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift"
    ];

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => funnelOriginFiles.includes(file));

    if (changedFiles.length === 0) return;

    const asanaTaskUrlRegex = /^\/\/\/\s*https:\/\/app\.asana\.com\/1\/137249556945\/project\/1207260194172075\/task\/\d+(\?\S*)?\s*$/;
    const casesWithInvalidLinks: { file: string; caseName: string }[] = [];

    for (const file of changedFiles) {
        const structuredDiff = await danger.git.structuredDiffForFile(file);
        if (!structuredDiff) continue;

        for (const chunk of structuredDiff.chunks) {
            let insideFunnelOriginEnum = false;
            let braceDepth = 0;

            // Check if the hunk header context mentions the funnel origin enum
            if (/enum\s+SubscriptionFunnelOrigin\b/.test(chunk.content)) {
                insideFunnelOriginEnum = true;
                braceDepth = 1;
            }

            const changes = chunk.changes;

            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];

                // Skip removed lines – they don't exist in the new file
                if (change.type === "del") continue;

                const content = change.content.length > 0 ? change.content.substring(1) : "";

                // Track funnel origin enum declaration
                if (/\benum\s+SubscriptionFunnelOrigin\b/.test(content)) {
                    insideFunnelOriginEnum = true;
                    braceDepth = 0;
                }

                // Track brace depth when inside the funnel origin enum
                if (insideFunnelOriginEnum) {
                    braceDepth += (content.match(/{/g) || []).length;
                    braceDepth -= (content.match(/}/g) || []).length;

                    if (braceDepth <= 0) {
                        insideFunnelOriginEnum = false;
                        continue;
                    }
                }

                if (!insideFunnelOriginEnum) continue;

                // Only check added lines for new case declarations
                if (change.type !== "add") continue;
                const caseMatch = content.match(/^\s*case\s+(\w+)/);
                if (!caseMatch) continue;

                // Found an added case line – walk upward through added comment lines looking for the Subscription Entry Points link
                let foundAsanaLink = false;
                for (let j = i - 1; j >= 0; j--) {
                    const prevChange = changes[j];
                    if (prevChange.type !== "add") break;
                    const prevContent = prevChange.content.substring(1).trim();
                    if (!prevContent.startsWith("///")) break;
                    if (asanaTaskUrlRegex.test(prevContent)) {
                        foundAsanaLink = true;
                        break;
                    }
                }

                if (!foundAsanaLink) {
                    casesWithInvalidLinks.push({ file, caseName: caseMatch[1] });
                }
            }
        }
    }

    if (casesWithInvalidLinks.length > 0) {
        const caseList = casesWithInvalidLinks.map(c => `- \`${c.caseName}\` in \`${c.file}\``).join("\n");
        warn(`New subscription funnel origin cases are missing a link to their Subscription Entry Points subtask:\n${caseList}\n\nAdd the new origin(s) under the [Subscription Entry Points task](https://app.asana.com/1/137249556945/project/1207260194172075/task/1209784982258586) and reference the matching subtask in the comment so the funnel-origin dashboards stay complete.\nExpected format: \`/// https://app.asana.com/1/137249556945/project/1207260194172075/task/<task_id>\``);
    }
}

export const pixelNamePrefix = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.endsWith(".swift"));

    // The `m[_-]` prefix matches both the legacy underscore form (`m_foo_bar`)
    // and the dashed form (`m-foo-bar`) that could appear if a pixel were
    // ported to the new dash-separated naming convention while keeping the
    // `m` namespace.

    // Matches an enum case with a rawValue string literal, e.g.:
    //   +    case appLaunch = "m_app_launch"
    //   +    case appLaunch = "m-app-launch"
    //   +    case foo(String) = "m_foo"
    const pixelCaseRegex = /^\+(?!\s*\/\/)\s*case\s+(\w+)(?:\([^)]*\))?\s*=\s*"(m[_-][^"]*)"/;

    // Matches a PixelKit-style `var name: String` return, in both multi-line
    // and inline-switch forms, e.g.:
    //   +        return "m_app_launch"
    //   +        return "m-app-launch"
    //   +        case .foo: return "m_app_launch"
    // The `.*` allows for arbitrary content (such as `case .x:`) between the
    // line marker and the `return` keyword. The negative lookahead still rules
    // out lines that begin with `//`.
    const pixelReturnRegex = /^\+(?!\s*\/\/).*\breturn\s+"(m[_-][^"]*)"/;

    const offendingCases: { file: string; snippet: string }[] = [];

    for (const file of changedFiles) {
        const diff = await danger.git.diffForFile(file);
        const addedLines = diff?.added.split(/\n/);
        if (!addedLines) continue;

        for (const line of addedLines) {
            const caseMatch = line.match(pixelCaseRegex);
            if (caseMatch) {
                offendingCases.push({ file, snippet: `case ${caseMatch[1]} = "${caseMatch[2]}"` });
                continue;
            }

            const returnMatch = line.match(pixelReturnRegex);
            if (returnMatch) {
                offendingCases.push({ file, snippet: `return "${returnMatch[1]}"` });
            }
        }
    }

    if (offendingCases.length > 0) {
        const caseList = offendingCases
            .map(c => `- \`${c.snippet}\` in \`${c.file}\``)
            .join("\n");
        warn(
            `The \`m_\` (or \`m-\`) pixel name prefix is no longer recommended. Please group pixels by app feature name instead.\n\nFound these new pixel definitions:\n${caseList}\n\nNote: for iOS the platform suffix is added automatically by the pixel pipeline, so you do not need to include \`ios\` (or \`m_\`/\`m-\`) in the pixel name. The same convention applies to macOS.`
        );
    }
}

export const debugViewVerbatimText = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.endsWith(".swift") && file.includes("Debug"));

    for (const file of changedFiles) {
        let diff = await danger.git.diffForFile(file);
        let addedLines = diff?.added.split(/\n/);
        // Matches added, non-commented lines containing Text("...") — use Text(verbatim:) in debug views to avoid translation.
        const foundLine = addedLines?.find(value =>
            /^\+(?!\s*\/\/).*\bText\s*\(\s*"/.test(value)
        );
        if (foundLine) {
            const cleanLine = foundLine.replace(/^\+\s*/, '').trim();
            warn(`Debug view \`${file}\` uses \`Text("...")\` which goes through the localization system. Use \`Text(verbatim:)\` instead to prevent strings from being translated:\n\`\`\`swift\n${cleanLine}\n\`\`\``);
        }
    }
}

export const legacyPixelUsage = async () => {
    // The legacy pixel system is iOS-only, so scope the check to apple-browsers.
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    // These files define the legacy pixel infrastructure itself, so their own
    // references to the types (and the internal plumbing between them) are fine.
    const excludedFiles = new Set([
        "iOS/Core/Pixel.swift",
        "iOS/Core/PixelEvent.swift",
        "iOS/Core/PixelFiring.swift",
        "iOS/Core/PixelFiringAsync.swift",
        "iOS/Core/DailyPixel.swift",
        "iOS/Core/DailyPixelFiring.swift",
        "iOS/Core/UniquePixel.swift",
        "iOS/Core/TimedPixel.swift",
        "iOS/Core/PersistentPixel.swift",
        "iOS/Core/PersistentPixelStoring.swift",
    ]);

    // Tests and mocks exercise the legacy types by design.
    const isTestOrMock = (file: string) =>
        file.includes("/Tests/") || /(?:Tests?|Mocks?)\.swift$/.test(file);

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file =>
        file.endsWith(".swift") &&
        !excludedFiles.has(file) &&
        !isTestOrMock(file)
    );

    // Each legacy symbol paired with a matcher for an added, non-comment line.
    //  - `Pixel` is matched via member access (`Pixel.`) so it does not collide
    //    with `PixelKit.`, `DailyPixel.`, a local `somePixel.`, etc. – the `\b`
    //    ensures only the standalone `Pixel` token matches.
    //  - The `PixelFiring` protocol is intentionally omitted: PixelKit's
    //    recommended replacement protocol shares the exact same name, so a token
    //    match can't distinguish the legacy one from the modern one.
    const legacySymbols: { name: string; regex: RegExp }[] = [
        { name: "Pixel", regex: /^\+(?!\s*\/\/).*\bPixel\./ },
        { name: "DailyPixel", regex: /^\+(?!\s*\/\/).*\bDailyPixel\b/ },
        { name: "UniquePixel", regex: /^\+(?!\s*\/\/).*\bUniquePixel\b/ },
        { name: "TimedPixel", regex: /^\+(?!\s*\/\/).*\bTimedPixel\b/ },
        { name: "PersistentPixel", regex: /^\+(?!\s*\/\/).*\bPersistentPixel\b/ },
    ];

    const offences: { file: string; symbol: string; snippet: string }[] = [];

    for (const file of changedFiles) {
        const diff = await danger.git.diffForFile(file);
        const addedLines = diff?.added.split(/\n/);
        if (!addedLines) continue;

        for (const line of addedLines) {
            for (const symbol of legacySymbols) {
                if (symbol.regex.test(line)) {
                    offences.push({
                        file,
                        symbol: symbol.name,
                        snippet: line.replace(/^\+\s*/, "").trim()
                    });
                    break; // one report per line is enough
                }
            }
        }
    }

    if (offences.length === 0) return;

    const list = offences
        .map(o => `- \`${o.symbol}\` in \`${o.file}\`: \`${o.snippet}\``)
        .join("\n");
    warn(
        "Legacy iOS pixel system is deprecated – use `PixelKit` instead.\n"+
         "(`Pixel`, `DailyPixel`, `UniquePixel`, `TimedPixel`, and `PersistentPixel` are deprecated).\n" +
        "See https://app.asana.com/1/137249556945/project/1208546505108826/task/1216768405353137?focus=true\n\n" +
        `Found these new uses:\n${list}`
    );
}

export const snapshotSubmodulePointer = async () => {
    // Reference images for the snapshot testing library live in a separate submodule
    // repo (duckduckgo/apple-browsers-snapshots). This check enforces that whenever a PR
    // moves the submodule pointer, the referenced commit is actually reachable on the
    // remote, and nudges the author towards the companion-PR workflow otherwise.
    //
    // See https://app.asana.com/1/137249556945/project/1214200115953388/task/1216991440153385
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    const submoduleOwner = "duckduckgo";
    const submoduleRepo = "apple-browsers-snapshots";
    const submoduleMainBranch = "main";
    const submodulePathMarker = "SnapshotReferences";
    const scriptPath = "scripts/open-snapshot-submodule-pr.sh";
    const mergeLabel = "merge snapshots";

    // A submodule pointer bump shows up in the monorepo diff as a change to the gitlink,
    // whose diff body contains `Subproject commit <sha>` lines. A first-time submodule
    // addition lands in created_files, so union both lists. Match on the submodule path
    // and confirm it's a gitlink change before doing anything.
    const submoduleFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => file.includes(submodulePathMarker));
    if (submoduleFiles.length === 0) return;

    const subprojectRegex = /^\+Subproject commit ([0-9a-f]{7,64})/m;
    let newCommit: string | undefined;
    for (const file of submoduleFiles) {
        const diff = await danger.git.diffForFile(file);
        const match = diff?.added.match(subprojectRegex);
        if (match) {
            newCommit = match[1];
            break;
        }
    }

    // Pointer unchanged (or the changed file wasn't actually a gitlink) → silent.
    if (!newCommit) return;

    // Ask the submodule repo where this commit sits relative to main. `compareCommits`
    // returns a `status` of behind/identical when `head` is contained in `base`, and
    // ahead/diverged when it carries commits main doesn't have. A missing commit 404s.
    try {
        const comparison = await danger.github.api.repos.compareCommits({
            owner: submoduleOwner,
            repo: submoduleRepo,
            base: submoduleMainBranch,
            head: newCommit
        });

        const status = comparison?.data?.status;
        if (status === "behind" || status === "identical") {
            // Contained in submodule main → pass.
            message(`The \`${submodulePathMarker}\` submodule points at \`${newCommit}\`, already merged into \`${submoduleRepo}\` \`${submoduleMainBranch}\`. ✅`);
            return;
        }

        // On the remote (companion PR still open) but not yet on main.
        fail(
            `The \`${submodulePathMarker}\` submodule points at \`${newCommit}\`, which is on \`${submoduleOwner}/${submoduleRepo}\` but not yet merged into \`${submoduleMainBranch}\`.\n` +
            `Review the companion PR, then apply the \`${mergeLabel}\` label to fold it in and update the pointer to the resulting \`${submoduleMainBranch}\` commit.`
        );
    } catch (error: any) {
        if (error?.status === 404) {
            // The commit isn't on the remote at all (unpushed / nonexistent).
            fail(
                `The \`${submodulePathMarker}\` submodule points at \`${newCommit}\`, which isn't on \`${submoduleOwner}/${submoduleRepo}\`.\n` +
                `Run \`${scriptPath}\` to push the reference changes and open the companion PR.`
            );
            return;
        }

        // Any other failure (network, permissions) shouldn't block the PR – warn instead.
        warn(`Couldn't verify the \`${submodulePathMarker}\` submodule pointer against \`${submoduleOwner}/${submoduleRepo}\`: ${error?.message ?? error}`);
    }
}

// Default run
export default async () => {
    await prSize()
    await internalLink()
    await xcodeprojConfiguration_macOS()
    await xcodeprojObjectVersion_macOS()
    await singletons()
    await userDefaultsWrapper()
    await remoteReleasableFeatureWarning()
    await localizedStrings()
    await licensedFonts()
    await newColors()
    await embeddedFilesURLMismatch()
    await releaseAndHotfixBranchBSKChangeWarning()
    await featureFlagAsanaLink()
    await subscriptionFunnelOriginAsanaLink()
    await pixelNamePrefix()
    await debugViewVerbatimText()
    await legacyPixelUsage()
    await snapshotSubmodulePointer()
}
