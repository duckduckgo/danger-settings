import {fail, warn, message, markdown, danger} from "danger"
import {execFileSync} from "child_process"
import {createHash} from "crypto"

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

const featureFlagFilePattern = /^(iOS|macOS)\/.*\/FeatureFlag\.swift$/;

function warnIfNoFeatureFlagFileExists() {
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (trackedFiles.split("\n").some(file => featureFlagFilePattern.test(file))) return;

    warn(`No file matching \`${featureFlagFilePattern}\` exists in the repo, so the feature flag Asana link check cannot run. If the feature flag enums moved, update \`featureFlagFilePattern\` in \`org/allPRs.ts\` in [danger-settings](https://github.com/duckduckgo/danger-settings).`);
}

export const featureFlagAsanaLink = async () => {
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file => featureFlagFilePattern.test(file));

    if (changedFiles.length === 0) {
        warnIfNoFeatureFlagFileExists();
        return;
    }

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

export const pixelKitSingletonUsage = async () => {
    // PixelKit lives only in apple-browsers, so scope the check to that repo.
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    // PixelKit's own sources declare the static entry points and legitimately reach for
    // `Self.shared`; its tests drive the singleton on purpose (`setUp` then `fire`).
    const isPixelKitPackage = (file: string) => file.includes("SharedPackages/PixelKit/");

    // Tests, test utilities and mocks may fire through the singleton by design, so they are
    // exempt. Matching a bare `Test` anywhere in the path is too broad: it also exempts shipping
    // code that happens to test something other than itself, such as the VPN's
    // `NetworkProtectionConnectionTester.swift` / `ConnectionTesting.swift`,
    // `HitTestingToolbar.swift` (hit testing, a UI concept) and the `PerformanceTest` and
    // `NetworkQualityMonitor` packages, which would then never be checked.
    //
    // A directory counts only when it names a test target (anything ending in `Tests`:
    // `Tests`, `UnitTests`, `DuckDuckGoTests`, `UITests`), a mock (`Mocks`, `TestDoubles`,
    // `MockVPNUIActionHandler`), a test-support module (`Test`/`Tests`/`Testing` followed by
    // `Utils`/`Utilities`/`Support`/`Helpers`/`DBBuilder`, covering `SharedTestUtils`,
    // `BookmarksTestsUtils`, `NetworkingTestingUtils`, `SharedTestUtilities`,
    // `SnapshotTestingSupport`, `AppUpdaterTestHelpers` and `HistoryTestDBBuilder`), or a
    // hyphenated test target (`sandbox-test-tool`, `tests-server`).
    const isTestTargetDirectory = (component: string) =>
        /Mock/.test(component) ||
        /(?:Tests|TestDoubles|Test(?:s|ing)?(?:Utils|Utilities|Support|Helpers|DBBuilder))$/.test(component) ||
        component.split("-").some(segment => segment === "test" || segment === "tests");

    // A file is test scaffolding wherever it sits when its name ends in `Test`/`Tests`/`Mock`/
    // `Mocks` (`PromoServiceFactory+Test.swift`), starts with `Tests`
    // (`TestsClosureNavigationResponder.swift`, DEBUG-only scaffolding inside the app target), or
    // mentions `Mock` at all. A leading singular `Test` is deliberately not enough:
    // `TestResult.swift` and `TestConfiguration.swift` are production files in the packages above.
    const isTestFileName = (name: string) =>
        /(?:Tests?|Mocks?)\.swift$/.test(name) || /^Tests[A-Z]/.test(name) || /Mock/.test(name);

    const isTestOrMock = (file: string) => {
        const components = file.split("/");
        return components.slice(0, -1).some(isTestTargetDirectory) ||
            isTestFileName(components[components.length - 1]);
    };

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(file =>
        file.endsWith(".swift") &&
        !isPixelKitPackage(file) &&
        !isTestOrMock(file)
    );

    // Matches an added, non-comment line that fires straight through the singleton, in either
    // shape it takes:
    //   PixelKit.fire(...)          / PixelKit.fireAsync(...)          - static shortcut
    //   PixelKit.shared?.fire(...)  / PixelKit.shared!.fireAsync(...)  - explicit singleton
    //
    // A bare `PixelKit.shared` is deliberately NOT matched. Handing it to a collaborator is the
    // sanctioned injection seam and its most common use by far, whether as a default argument
    // (`init(pixelFiring: (any PixelKitFiring)? = PixelKit.shared)`) or at a composition root.
    // Only reaching for the singleton at the point of firing skips the seam.
    const singletonFireRegex =
        /^\+(?!\s*\/\/).*\bPixelKit\s*\.\s*(?:shared\s*[?!]?\s*\.\s*)?fire(?:Async)?\s*\(/;

    const offences: { file: string; snippet: string }[] = [];

    for (const file of changedFiles) {
        const diff = await danger.git.diffForFile(file);
        const addedLines = diff?.added.split(/\n/);
        if (!addedLines) continue;

        for (const line of addedLines) {
            if (singletonFireRegex.test(line)) {
                offences.push({ file, snippet: line.replace(/^\+\s*/, "").trim() });
            }
        }
    }

    if (offences.length === 0) return;

    const list = offences
        .map(o => `- \`${o.file}\`: \`${o.snippet}\``)
        .join("\n");
    warn(
        "Firing a pixel straight through the `PixelKit` singleton leaves the call site untestable. " +
        "Inject a `PixelKitFiring` (the exported alias for PixelKit's `PixelFiring` protocol) and " +
        "call `fire` on it instead:\n" +
        "```swift\n" +
        "init(pixelFiring: (any PixelKitFiring)? = PixelKit.shared) { self.pixelFiring = pixelFiring }\n" +
        "...\n" +
        "pixelFiring?.fire(SomePixel.event, frequency: .daily)\n" +
        "```\n" +
        "Passing `PixelKit.shared` as that dependency is fine, and is what the default argument " +
        "above does. It is reaching for the singleton at the point of firing that this flags.\n" +
        "See `SharedPackages/PixelKit/Sources/PixelKit/PixelFiring.swift` for the protocol, and the\n" +
        "singleton section of `.cursor/rules/anti-patterns.mdc` for why the seam matters.\n\n" +
        `Found these new direct singleton fires:\n${list}`
    );
}

export const noNewPixelEventCases = async () => {
    // This file is iOS-only, so scope the check to apple-browsers.
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    const file = "iOS/Core/PixelEvent.swift";
    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ];
    if (!changedFiles.includes(file)) return;

    const diff = await danger.git.diffForFile(file);
    if (!diff) return;

    // Matches a `case someName` (enum declaration) or `case .someName:` / `case .someName(...)`
    // (a `name` switch arm, or any other per-case switch), with an optional leading `+`/`-` diff
    // marker so the same matcher works on raw file content and on diff lines alike. Associated
    // values after the identifier are ignored - only the case identifier matters here.
    const caseIdentifier = (line: string) => {
        const match = line.match(/^[+-]?\s*case\s+\.?(\w+)/);
        return match ? match[1] : null;
    };

    // Every case identifier that existed anywhere in the file before this PR. Comparing only
    // against removed diff lines would misfire on a PR that adds a brand new switch statement
    // over already-existing cases (e.g. a fresh per-case property) - that reintroduces those
    // identifiers as "added" lines without removing anything, since no prior switch existed to
    // remove lines from.
    const existingCases = new Set(
        diff.before.split(/\n/).map(caseIdentifier).filter((id): id is string => id !== null)
    );

    const newCases: string[] = [];
    for (const line of diff.added.split(/\n/)) {
        const identifier = caseIdentifier(line);
        if (identifier && !existingCases.has(identifier)) {
            newCases.push(line.replace(/^\+\s*/, "").trim());
        }
    }

    if (newCases.length === 0) return;

    const list = newCases.map(snippet => `- \`${snippet}\``).join("\n");
    fail(
        `\`${file}\` is deprecated for new pixels - its own top-of-file notice says not to add any more here. ` +
        "Define new iOS pixels as a separate type conforming to `PixelKit.Event` instead.\n\n" +
        `Found what looks like new case(s):\n${list}\n\n` +
        "Modifying an existing case (its `name` string, associated values, etc.) or removing one is fine - " +
        "this check only blocks a case identifier that didn't exist in the file before this PR."
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

// Pixel privacy gate: pixel changes need a PixelDefinitions update and the privacy review label.
// A best-effort heuristic and a self-triage reminder, not a validator of what the definitions say.
// See https://app.asana.com/1/137249556945/project/1201392122292466/task/1219449170013612

const privacyReviewLabel = "privacy review required";
const skipPixelCheckLabel = "skip pixel check";
const pixelProtocols = /\b(?:PixelKit\.Event|PixelKitEvent|WideEventData|WideEventDataMeasuringInterval)\b/;
const pixelDefinitionsPath = /^(iOS|macOS)\/PixelDefinitions\/(pixels|wide_events)\//;
const swiftTestPath = /(^|\/)(Tests?|UnitTests|IntegrationTests|UITests|DuckDuckGoTests|TestingSupport|TestUtils|Mocks?)(\/|$)|Tests?\.swift$|Mock[^/]*\.swift$/;
const pixelFireWithParameters = /\.fire\w*\(.*\b(withAdditionalParameters|parameters|params)\b|\bwithAdditionalParameters\b/i;

const pixelFalsePositiveReportURL = "https://app.asana.com/1/137249556945/project/1203301625297703/list/1205116726912022";
const pixelSnippetLineLimit = 30;
const pixelReportOpenLineLimit = 20;

type PixelCodeChange = { side: "+" | "-", path: string, line: string, key: string, order: number };
type LineRange = [number, number];

export const pixelPrivacyGate = async () => {
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files,
        ...danger.git.deleted_files
    ];
    const definitionFiles = changedFiles.filter(file => pixelDefinitionsPath.test(file));
    const codeChanges = await pixelCodeChanges(changedFiles.filter(isSwiftSource));
    if (codeChanges.length === 0 && definitionFiles.length === 0) return;

    const labels = (danger.github?.issue?.labels ?? []).map(label => label.name);
    if (labels.includes(skipPixelCheckLabel)) return;

    const hasCodeChanges = codeChanges.length > 0;
    const hasDefinitionChanges = definitionFiles.length > 0;
    const onlyRemovesPixels = codeChanges.every(change => change.side === "-") && !(await anyLinesAdded(definitionFiles));

    if (hasCodeChanges && !hasDefinitionChanges) {
        fail(
            "**Pixel code changed, but PixelDefinitions didn't.** Add or update the pixel under `iOS/PixelDefinitions` or `macOS/PixelDefinitions` " +
            "(the `ddg-add-pixel` skill covers it). The flagged lines are under *Pixel changes* below. " +
            `If none of them changes what a pixel sends, add the \`${skipPixelCheckLabel}\` label.`
        );
    }
    if (!onlyRemovesPixels && !labels.includes(privacyReviewLabel)) {
        fail(codeChanges.some(change => change.side === "+")
            ? "**This PR adds or changes pixels, so it needs a privacy review.** " +
              `When it's ready for review, add the \`${privacyReviewLabel}\` label. It creates the privacy review task in Asana.`
            : "**Pixel definitions changed.** " +
              `New pixel, or a name or parameter change? Add \`${privacyReviewLabel}\`. Only descriptions or formatting? Add \`${skipPixelCheckLabel}\`.`
        );
    }
    if (hasCodeChanges) {
        markdown(pixelChangesReport(codeChanges, hasDefinitionChanges));
    }
}

function isSwiftSource(file: string) {
    return file.endsWith(".swift") && !swiftTestPath.test(file);
}

async function anyLinesAdded(files: string[]) {
    for (const file of files) {
        if ((await danger.git.diffForFile(file))?.added) return true;
    }
    return false;
}

async function pixelCodeChanges(files: string[]): Promise<PixelCodeChange[]> {
    const knownTypes = pixelTypeNames();
    const typeBodyChanges: PixelCodeChange[] = [];
    const callSiteChanges: PixelCodeChange[] = [];
    let order = 0;

    for (const file of files) {
        const structuredDiff = await danger.git.structuredDiffForFile(file);
        if (!structuredDiff) continue;
        const diff = await danger.git.diffForFile(file);
        const before = structuredDiff.fromPath && structuredDiff.fromPath !== file
            ? await danger.github.utils.fileContents(structuredDiff.fromPath, undefined, danger.git.base)
            : diff?.before;
        const rangesBefore = pixelTypeRanges(before ?? "", knownTypes);
        const rangesAfter = pixelTypeRanges(diff?.after ?? "", knownTypes);

        const changes = structuredDiff.chunks.reduce((all, chunk) => all.concat(chunk.changes), [] as typeof structuredDiff.chunks[0]["changes"]);
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            if (change.type === "normal") continue;
            const side = change.type === "add" ? "+" : "-";
            const line = change.content.slice(1);
            if (!isMeaningfulSwiftLine(line)) continue;

            const ranges = side === "+" ? rangesAfter : rangesBefore;
            if (ranges.some(([start, end]) => change.ln >= start && change.ln <= end)) {
                typeBodyChanges.push({ side, path: file, line, order: order++, key: line.replace(/\bself\./g, "").replace(/\s+/g, " ").trim() });
                continue;
            }
            const call = pixelCallStatement(changes, i);
            i += call.lineCount - 1;
            if (pixelFireWithParameters.test(call.text) && !/\bfunc\s/.test(call.text)) {
                callSiteChanges.push({ side, path: file, line: call.text, order: order++, key: pixelCallSignature(call.text) });
            }
        }
    }
    return [...withoutMovedLines(typeBodyChanges), ...withoutMovedLines(callSiteChanges)].sort((a, b) => a.order - b.order);
}

// Pixel types declared anywhere in the repo, so extending one in another file counts too.
function pixelTypeNames(): Set<string> {
    const names = new Set(["Pixel.Event"]);
    let declarations = "";
    try {
        declarations = execFileSync("git", ["grep", "-hE", "(PixelKit\\.Event|PixelKitEvent|WideEventData)\\b", "--", "*.swift"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch {
        // git grep exits non-zero when nothing matches.
    }
    for (const [, name, conformances] of allMatches(/\b(?:enum|struct|class|actor|extension)\s+([A-Za-z_][\w.]*)\s*(?:<[^>{]*>)?\s*:([^{]*)/g, declarations)) {
        if (pixelProtocols.test(conformances)) names.add(name);
    }
    return names;
}

// 1-based inclusive line ranges of each pixel type body.
function pixelTypeRanges(source: string, knownTypes: Set<string>): LineRange[] {
    const code = blankOutSwiftCommentsAndStrings(source);
    const lineAt = (index: number) => code.slice(0, index).split("\n").length;
    const ranges: LineRange[] = [];
    for (const match of allMatches(/\b(enum|struct|class|actor|extension)\s+([A-Za-z_][\w.]*)([^{]*)\{/g, code)) {
        const [declaration, kind, name, rest] = match;
        const conformsToPixelProtocol = pixelProtocols.test(rest.replace(/<[^>]*>/g, ""));
        const extendsPixelType = kind === "extension" && knownTypes.has(name);
        const isIOSPixelEvent = kind === "enum" && name === "Event" && /extension\s+Pixel\s*\{/.test(code.slice(0, match.index));
        if (!conformsToPixelProtocol && !extendsPixelType && !isIOSPixelEvent) continue;

        const openingBrace = match.index! + declaration.length - 1;
        ranges.push([lineAt(match.index!), lineAt(closingBraceIndex(code, openingBrace))]);
    }
    return ranges;
}

// Keeps line structure intact so line numbers still match the original source.
function blankOutSwiftCommentsAndStrings(source: string) {
    const blank = (text: string) => text.replace(/[^\n]/g, " ");
    return source
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/\/\/[^\n]*/g, blank)
        .replace(/"(?:\\.|[^"\\\n])*"/g, literal => `"${blank(literal.slice(1, -1))}"`);
}

function allMatches(regex: RegExp, text: string): RegExpExecArray[] {
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) matches.push(match);
    regex.lastIndex = 0;
    return matches;
}

function closingBraceIndex(code: string, openingBrace: number) {
    let depth = 0;
    for (let i = openingBrace; i < code.length; i++) {
        if (code[i] === "{") depth++;
        else if (code[i] === "}" && --depth === 0) return i;
    }
    return code.length - 1;
}

function isMeaningfulSwiftLine(line: string) {
    const trimmed = line.trim();
    return trimmed !== "" && !/^(\/\/|\/\*|\*)/.test(trimmed) && !/^[{}()[\],]+$/.test(trimmed);
}

// A pixel call split over several added (or removed) lines, joined into one, so its parameters are compared as a whole.
function pixelCallStatement(changes: { type: string, content: string }[], start: number) {
    let text = changes[start].content.slice(1);
    let lineCount = 1;
    const openParentheses = (code: string) => {
        const withoutStrings = code.replace(/"(?:\\.|[^"\\])*"/g, "");
        return withoutStrings.split("(").length - withoutStrings.split(")").length;
    };
    if (!/\bfire\w*\(/.test(text)) return { text, lineCount };
    while (openParentheses(text) > 0 && lineCount < 10 && changes[start + lineCount]?.type === changes[start].type) {
        text += " " + changes[start + lineCount].content.slice(1).trim();
        lineCount++;
    }
    return { text, lineCount };
}

// The event and literal parameter keys, so re-spelling the same call through another API is not a change.
// A trailing call such as `.withError(error)` is not part of the event name.
function pixelCallSignature(line: string) {
    const event = line.match(/fire\w*\(\s*(?:\w+:\s*)?\.?([\w.]+)/)?.[1].replace(/\.withError$/, "").split(".").pop() ?? "";
    const keys = allMatches(/"([\w-]+)"\s*:/g, line).map(match => match[1]).sort();
    return `${event}|${keys.join(",")}`;
}

// Drops added/removed pairs with the same key: that code moved, it didn't change.
function withoutMovedLines(changes: PixelCodeChange[]) {
    const countBySide = (side: string) => {
        const counts = new Map<string, number>();
        for (const change of changes) {
            if (change.side === side) counts.set(change.key, (counts.get(change.key) ?? 0) + 1);
        }
        return counts;
    };
    const unmatched = { "+": countBySide("-"), "-": countBySide("+") };
    return changes.filter(change => {
        const counterparts = unmatched[change.side];
        const count = counterparts.get(change.key) ?? 0;
        if (count === 0) return true;
        counterparts.set(change.key, count - 1);
        return false;
    });
}

// Files that only lose pixel code are listed with a count; their lines add nothing to check against the definitions.
function pixelChangesReport(changes: PixelCodeChange[], hasDefinitionChanges: boolean) {
    const files = changesByFile(changes);
    const editedFiles = files.filter(file => file.changes.some(change => change.side === "+"));
    const removalOnlyFiles = files.filter(file => editedFiles.indexOf(file) === -1);
    const shownLineCount = editedFiles.reduce((sum, file) => sum + Math.min(file.changes.length, pixelSnippetLineLimit), 0);

    const sections = [
        "### Pixel changes",
        "Changed lines that look like pixel code (not the full diff)." +
            (hasDefinitionChanges ? "\n**Make sure every pixel name and parameter change is reflected in the definitions.**" : ""),
        ...editedFiles.map(file => pixelFileSnippet(file, shownLineCount <= pixelReportOpenLineLimit)),
    ];
    if (removalOnlyFiles.length > 0) {
        sections.push("Removed pixel code:\n" + removalOnlyFiles.map(file => `- \`${file.path}\` −${file.changes.length}`).join("\n"));
    }
    sections.push(`<sub>Flagged something that isn't a pixel change? Add the \`${skipPixelCheckLabel}\` label and [let us know](${pixelFalsePositiveReportURL}) so the check can be improved.</sub>`);
    return sections.join("\n\n");
}

function changesByFile(changes: PixelCodeChange[]) {
    const files: { path: string, changes: PixelCodeChange[] }[] = [];
    for (const change of changes) {
        const file = files.find(candidate => candidate.path === change.path);
        if (file) file.changes.push(change);
        else files.push({ path: change.path, changes: [change] });
    }
    return files;
}

function pixelFileSnippet({ path, changes }: { path: string, changes: PixelCodeChange[] }, isOpen: boolean) {
    const count = (side: string) => changes.filter(change => change.side === side).length;
    const indent = Math.min(...changes.map(change => change.line.match(/^\s*/)![0].length));
    const lines = changes.slice(0, pixelSnippetLineLimit).map(change => `${change.side} ${change.line.slice(indent)}`);
    const hiddenCount = changes.length - lines.length;
    const footer = [hiddenCount > 0 ? `… ${hiddenCount} more lines.` : "", pixelFileDiffLink(path)].filter(Boolean).join(" ");
    return `<details${isOpen ? " open" : ""}><summary><code>${path}</code> +${count("+")} −${count("-")}</summary>\n\n` +
        `\`\`\`diff\n${lines.join("\n")}\n\`\`\`\n${footer ? `\n${footer}\n` : ""}</details>`;
}

function pixelFileDiffLink(path: string) {
    const prURL = danger.github?.pr?.html_url;
    return prURL ? `[View in the diff](${prURL}/files#diff-${createHash("sha256").update(path).digest("hex")})` : "";
}

// New error types should adopt DDGError so they carry a stable domain, code and underlying-error
// chain wherever they end up: pixels, logs or the UI.
const errorProtocols = new Set(["Error", "LocalizedError", "CustomNSError", "RecoverableError"]);
const errorTypeDeclaration =
    /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|private|fileprivate|internal|package|open|final|indirect|nonisolated)\s+)*(?:enum|struct|class|actor|extension)\s+([A-Za-z_][\w.]*)\s*(?:<[^{]*?>)?\s*:\s*([^{]*)/;

export const ddgErrorConformance = async () => {
    // DDGError lives only in apple-browsers, so scope the check to that repo.
    if (danger.github?.thisPR?.repo !== "apple-browsers") return;

    const changedFiles = [
        ...danger.git.modified_files,
        ...danger.git.created_files
    ].filter(isSwiftSource);
    if (changedFiles.length === 0) return;

    // A declaration removed anywhere in the PR was already there, so moving or editing a type
    // (a moved file shows up as deleted plus created) does not count as a new one.
    const existingTypes = new Set<string>();
    const filesWithRemovals = [
        ...danger.git.modified_files,
        ...(danger.git.deleted_files ?? [])
    ].filter(file => file.endsWith(".swift"));
    for (const file of filesWithRemovals) {
        const diff = await danger.git.diffForFile(file);
        for (const line of diff?.removed?.split(/\n/) ?? []) {
            const declaration = errorTypeConformance(line, "-");
            if (declaration) existingTypes.add(declaration.name);
        }
    }

    const offences: { file: string, snippet: string }[] = [];
    for (const file of changedFiles) {
        const diff = await danger.git.diffForFile(file);
        for (const line of diff?.added?.split(/\n/) ?? []) {
            const declaration = errorTypeConformance(line, "+");
            if (!declaration || existingTypes.has(declaration.name)) continue;
            if (declaration.conformances.includes("DDGError")) continue;
            if (!declaration.conformances.some(conformance => errorProtocols.has(conformance))) continue;
            offences.push({ file, snippet: line.replace(/^\+\s*/, "").trim() });
        }
    }

    if (offences.length === 0) return;

    const list = offences
        .map(o => `- \`${o.file}\`: \`${o.snippet}\``)
        .join("\n");
    warn(
        "New error types should conform to `DDGError` rather than plain `Error`, `LocalizedError` or `CustomNSError`. " +
        "`DDGError` gives every error a stable domain and code and keeps the underlying-error chain, " +
        "so it stays readable in pixels, logs and the UI:\n" +
        "```swift\n" +
        "enum SomeFeatureError: DDGError {\n" +
        "    case failed(underlying: Error)\n" +
        "\n" +
        "    static var errorDomain: String { \"com.duckduckgo.someFeature\" }\n" +
        "    var errorCode: Int { ... }\n" +
        "    var underlyingError: Error? { ... }\n" +
        "    var description: String { ... }\n" +
        "}\n" +
        "```\n" +
        "See `SharedPackages/DDGError/Sources/DDGError/DDGError.swift`.\n\n" +
        `Found these new error types:\n${list}`
    );
}

// The declared type name and its conformances, for a non-comment diff line with the given marker.
function errorTypeConformance(line: string, marker: "+" | "-") {
    if (!line.startsWith(marker)) return null;
    const code = line.slice(1).replace(/\/\/.*$/, "");
    const match = code.match(errorTypeDeclaration);
    if (!match) return null;
    const conformances = match[2]
        .split(/\bwhere\b/)[0]
        .split(",")
        .map(conformance => conformance.trim().split(".").pop() ?? "")
        .filter(conformance => conformance.length > 0);
    return { name: match[1], conformances };
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
    await pixelKitSingletonUsage()
    await noNewPixelEventCases()
    await snapshotSubmodulePointer()
    await pixelPrivacyGate()
    await ddgErrorConformance()
}
