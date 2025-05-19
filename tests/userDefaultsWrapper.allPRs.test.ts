jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { userDefaultsWrapper } from '../org/allPRs'

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

describe("@UserDefaultsWrapper checks", () => {
    it("does not fail with no changes to Swift files", async () => {
        dm.danger.git.modified_files = []

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no diff in Swift files", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with no additions", async () => {
        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with non-@UserDefaultsWrapper additions", async () => {
        dm.addedLines = `
+		let subscription = PrivacyProSubscription(status: .inactive)
+       let isSubscribed: Bool
+       var billingPeriod: String?
+       public let startedAt: Int?
+       internal let expiresOrRenewsAt: Int?
+       private var paymentPlatform: String?
+       let status: String?
        `

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with UserDefaultsWrapper usage additions", async () => {
        dm.addedLines = `
+       let userDefaults: UserDefaults = UserDefaultsWrapper<Any>.sharedDefaults
        `

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does not fail with commented out @UserDefaultsWrapper additions", async () => {
        dm.addedLines = `
+		// @UserDefaultsWrapper(key: .homePageIsFavoriteVisible, defaultValue: true)
        `

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("fails with @UserDefaultsWrapper additions", async () => {
        dm.addedLines = `
+		@UserDefaultsWrapper(key: .homePageIsFavoriteVisible, defaultValue: true)
        `

        await userDefaultsWrapper()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with @UserDefaultsWrapper additions with open bracket only", async () => {
        dm.addedLines = `
+		@UserDefaultsWrapper(
+           key: .homePageIsFavoriteVisible,
+           defaultValue: true
+       )
        `

        await userDefaultsWrapper()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("fails with @UserDefaultsWrapper additions without parameters", async () => {
        dm.addedLines = `
+		@UserDefaultsWrapper
+       private var didCrashDuringCrashHandlersSetUp: Bool
        `

        await userDefaultsWrapper()
        expect(dm.fail).toHaveBeenCalled()
    })

    it("does not fail with @UserDefaultsWrapper deletions", async () => {
        dm.addedLines = `
-		@UserDefaultsWrapper
-       private var didCrashDuringCrashHandlersSetUp: Bool
-
-		@UserDefaultsWrapper(
-           key: .homePageIsFavoriteVisible,
-           defaultValue: true
-       )
-
-		@UserDefaultsWrapper(key: .homePageIsFavoriteVisible, defaultValue: true)
-       var isFavoriteVisible: Bool
        `

        await userDefaultsWrapper()
        expect(dm.fail).not.toHaveBeenCalled()
    })
})
