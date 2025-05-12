jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { singletons } from '../org/allPRs'

beforeEach(() => {
    dm.addedLines = ""
    dm.fail = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (_filename) => {
                return { added: dm.addedLines }
            },
            modified_files: [
                "ModifiedFile.swift"
            ],
            created_files: [
                "CreatedFile.swift"
            ]
        }
    }
})

describe("Singletons checks", () => {
    it("does not fail with no changes to Swift files", async () => {
        dm.danger.git.modified_files = []

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with non-singleton additions", async () => {
        dm.addedLines = `
+		let subscription = PrivacyProSubscription(status: .inactive)
+       let isSubscribed: Bool
+       var billingPeriod: String?
+       public let startedAt: Int?
+       internal let expiresOrRenewsAt: Int?
+       private var paymentPlatform: String?
+       let status: String?
        `

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with singleton usage additions", async () => {
        dm.addedLines = `
+		let favicon = FaviconManager.shared.favicon(for: url)
        `

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with commented out singleton additions", async () => {
        dm.addedLines = `
+		// static let shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with singleton additions", async () => {
        dm.addedLines = `
+		static let shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with singleton additions with type specifier", async () => {
        dm.addedLines = `
+		static let shared: FaviconManager = .init()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with private singleton additions", async () => {
        dm.addedLines = `
+		private static let shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with internal singleton additions", async () => {
        dm.addedLines = `
+		internal static let shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with public singleton additions", async () => {
        dm.addedLines = `
+		public static let shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with var singleton additions", async () => {
        dm.addedLines = `
+		static var shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with private var singleton additions", async () => {
        dm.addedLines = `
+		private static var shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with internal var singleton additions", async () => {
        dm.addedLines = `
+		internal static var shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with public var singleton additions", async () => {
        dm.addedLines = `
+		public static var shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("does not fail with singleton deletions", async () => {
        dm.addedLines = `
-		static let shared = FaviconManager()
-		private static let shared = FaviconManager()
-		internal static let shared = FaviconManager()
-		public static let shared = FaviconManager()
-		static var shared = FaviconManager()
-		private static var shared = FaviconManager()
-		internal static var shared = FaviconManager()
-		public static var shared = FaviconManager()
        `

        await singletons()
        expect(dm.fail).not.toHaveBeenCalled()
    })
})
