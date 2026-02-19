jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { featureFlagAsanaLink } from '../org/allPRs'

// Helper to build a structuredDiff from a raw unified diff string.
// Parses hunk headers (@@ lines) and change lines (+, -, context).
function buildStructuredDiff(rawDiff: string) {
    const lines = rawDiff.split(/\n/);
    const chunks: any[] = [];
    let currentChunk: any = null;

    for (const line of lines) {
        if (line.startsWith("@@")) {
            currentChunk = { content: line, changes: [] };
            chunks.push(currentChunk);
        } else if (currentChunk && line.length > 0) {
            let type: string;
            if (line.startsWith("+")) {
                type = "add";
            } else if (line.startsWith("-")) {
                type = "del";
            } else {
                type = "normal";
            }
            currentChunk.changes.push({ type, content: line });
        }
    }

    return { chunks };
}

beforeEach(() => {
    dm.rawDiff = ""
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            structuredDiffForFile: async (_filename) => {
                if (!dm.rawDiff) return null;
                return buildStructuredDiff(dm.rawDiff);
            },
            modified_files: [
                "iOS/Core/FeatureFlag.swift"
            ],
            created_files: []
        }
    }
})

describe("Feature flag Asana link checks", () => {
    it("does not warn when no feature flag files are changed", async () => {
        dm.danger.git.modified_files = ["SomeOtherFile.swift"]

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when diff has no added case lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    var rawValue: String
+    var source: FeatureFlagSource`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when added case has valid Asana link above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when added case with assignment has valid Asana link above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/999888777
+    case anotherFeature = "anotherFeature"`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when added case has no comment above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum FeatureFlag {
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when added case has a non-Asana comment above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    /// Some description of the feature
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when added case has an Asana link with wrong project ID", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/9999999999999999/task/123456789
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when comment above is a context line (not added)", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum FeatureFlag {
 /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("works with macOS feature flag file", async () => {
        dm.danger.git.modified_files = [
            "macOS/LocalPackages/FeatureFlags/Sources/FeatureFlags/FeatureFlag.swift"
        ]
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case macOSFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns for macOS feature flag file with missing link", async () => {
        dm.danger.git.modified_files = [
            "macOS/LocalPackages/FeatureFlags/Sources/FeatureFlags/FeatureFlag.swift"
        ]
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum FeatureFlag {
+    case macOSFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not warn when diff is empty", async () => {
        dm.rawDiff = ""

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed case lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,5 @@ enum FeatureFlag {
-    case removedFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for case added in a different enum", async () => {
        dm.rawDiff = `@@ -50,6 +50,7 @@ enum SomeOtherEnum {
+    case otherEnumCase`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns for case in FeatureFlag enum but not in other enum in same diff", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SomeOtherEnum {
+    case otherEnumCase
@@ -50,6 +50,7 @@ enum FeatureFlag {
+    case featureFlagCase`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not warn for case in other enum when FeatureFlag cases are valid", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SomeOtherEnum {
+    case otherEnumCase
@@ -50,6 +50,8 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case featureFlagCase`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("tracks FeatureFlag enum declared in the diff itself", async () => {
        dm.rawDiff = `@@ -10,6 +10,10 @@
+enum FeatureFlag: String {
+    case myNewFeature
+}`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not warn when Asana link is above other comment lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,10 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    /// Some description of the feature
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when Asana link is several comment lines above case", async () => {
        dm.rawDiff = `@@ -10,6 +10,11 @@ enum FeatureFlag {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    /// First line of description
+    /// Second line of description
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when comment block has no Asana link at all", async () => {
        dm.rawDiff = `@@ -10,6 +10,10 @@ enum FeatureFlag {
+    /// First line of description
+    /// Second line of description
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not check cases after FeatureFlag enum closing brace", async () => {
        dm.rawDiff = `@@ -10,6 +10,12 @@
+enum FeatureFlag: String {
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case validFeature
+}
+enum AnotherEnum {
+    case nolinkNeeded
+}`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("ignores braces from removed lines when tracking FeatureFlag enum scope", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
-    }
+    /// https://app.asana.com/1/137249556945/project/1211834678943996/task/123456789
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when removed braces would have hidden a missing link", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum FeatureFlag {
-    }
+    case myNewFeature`

        await featureFlagAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })
})
