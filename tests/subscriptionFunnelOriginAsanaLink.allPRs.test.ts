jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { subscriptionFunnelOriginAsanaLink } from '../org/allPRs'

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

const SUBSCRIPTION_ENTRY_POINTS = "https://app.asana.com/1/137249556945/project/1207260194172075/task/1209784982258586";

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
                "iOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift"
            ],
            created_files: []
        }
    }
})

describe("Subscription funnel origin Asana link checks", () => {
    it("does not warn when no funnel origin files are changed", async () => {
        dm.danger.git.modified_files = ["SomeOtherFile.swift"]

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when diff has no added case lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    // MARK: - Win-Back Offer Origins
+    // some comment`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when added case has the Subscription Entry Points link above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    /// ${SUBSCRIPTION_ENTRY_POINTS}
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when Subscription Entry Points link has query parameters", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    /// ${SUBSCRIPTION_ENTRY_POINTS}?focus=true
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when the Subscription Entry Points link is above other comment lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,11 @@ enum SubscriptionFunnelOrigin: String {
+    /// ${SUBSCRIPTION_ENTRY_POINTS}
+    /// User entered the funnel via some new surface.
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns when added case has no comment above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SubscriptionFunnelOrigin: String {
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when added case has a non-Subscription Entry Points comment above it", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    /// User entered the funnel via some new surface.
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when link points to a different task", async () => {
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    /// https://app.asana.com/1/137249556945/project/1207260194172075/task/9999999999999999
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns when the Subscription Entry Points link is a context line (not added)", async () => {
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SubscriptionFunnelOrigin: String {
 /// ${SUBSCRIPTION_ENTRY_POINTS}
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("works with the macOS funnel origin file", async () => {
        dm.danger.git.modified_files = [
            "macOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift"
        ]
        dm.rawDiff = `@@ -10,6 +10,8 @@ enum SubscriptionFunnelOrigin: String {
+    /// ${SUBSCRIPTION_ENTRY_POINTS}
+    case macOSOrigin = "funnel_mynew_macos"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns for the macOS funnel origin file with missing link", async () => {
        dm.danger.git.modified_files = [
            "macOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift"
        ]
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SubscriptionFunnelOrigin: String {
+    case macOSOrigin = "funnel_mynew_macos"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("warns for a newly created funnel origin file with a missing link", async () => {
        dm.danger.git.modified_files = []
        dm.danger.git.created_files = [
            "iOS/DuckDuckGo/Subscription/SubscriptionFunnelOrigin.swift"
        ]
        dm.rawDiff = `@@ -10,6 +10,7 @@ enum SubscriptionFunnelOrigin: String {
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not warn for cases added to SubscriptionRestoreFunnelOrigin", async () => {
        dm.rawDiff = `@@ -60,6 +60,7 @@ enum SubscriptionRestoreFunnelOrigin: String {
+    case myNewRestoreOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when diff is empty", async () => {
        dm.rawDiff = ""

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for removed case lines", async () => {
        dm.rawDiff = `@@ -10,6 +10,5 @@ enum SubscriptionFunnelOrigin: String {
-    case removedOrigin = "funnel_removed_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for a case added in an unrelated enum", async () => {
        dm.rawDiff = `@@ -50,6 +50,7 @@ enum SomeOtherEnum {
+    case otherEnumCase`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("tracks a funnel origin enum declared in the diff itself", async () => {
        dm.rawDiff = `@@ -10,6 +10,10 @@
+enum SubscriptionFunnelOrigin: String {
+    case myNewOrigin = "funnel_mynew_ios"
+}`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("detects the enum from a context line when the hunk header omits it", async () => {
        dm.rawDiff = `@@ -20,6 +20,7 @@ import Foundation
 enum SubscriptionFunnelOrigin: String {
+    case myNewOrigin = "funnel_mynew_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalled()
    })

    it("does not check cases after the funnel origin enum closing brace", async () => {
        dm.rawDiff = `@@ -10,6 +10,12 @@
+enum SubscriptionFunnelOrigin: String {
+    /// ${SUBSCRIPTION_ENTRY_POINTS}
+    case validOrigin = "funnel_valid_ios"
+}
+enum AnotherEnum {
+    case noLinkNeeded
+}`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("reports all cases missing links in a single warning", async () => {
        dm.rawDiff = `@@ -10,6 +10,10 @@ enum SubscriptionFunnelOrigin: String {
+    case firstOrigin = "funnel_first_ios"
+    /// ${SUBSCRIPTION_ENTRY_POINTS}
+    case validOrigin = "funnel_valid_ios"
+    case secondOrigin = "funnel_second_ios"`

        await subscriptionFunnelOriginAsanaLink()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        const message = dm.warn.mock.calls[0][0]
        expect(message).toContain("firstOrigin")
        expect(message).toContain("secondOrigin")
        expect(message).not.toContain("validOrigin")
    })
})
