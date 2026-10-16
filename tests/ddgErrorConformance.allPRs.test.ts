jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { ddgErrorConformance } from '../org/allPRs'

const SOURCE_FILE = "SharedPackages/Feature/Sources/Feature/FeatureService.swift"

beforeEach(() => {
    dm.diffs = {}
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            diffForFile: async (filename) => dm.diffs[filename] ?? { added: "", removed: "" },
            modified_files: [SOURCE_FILE],
            created_files: [],
            deleted_files: []
        },
        github: {
            thisPR: {
                repo: "apple-browsers"
            }
        },
    }
})

function setDiff(file: string, added: string, removed = "") {
    dm.diffs[file] = { added, removed }
}

function warnMessage() {
    return dm.warn.mock.calls[0][0] as string
}

describe("DDGError conformance check", () => {
    it("warns when a new enum conforms to Error", async () => {
        setDiff(SOURCE_FILE, `
+public enum StartupError: Error, CustomNSError {
        `)

        await ddgErrorConformance()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        expect(warnMessage()).toContain("public enum StartupError: Error, CustomNSError {")
        expect(warnMessage()).toContain(SOURCE_FILE)
        expect(warnMessage()).toContain("DDGError")
    })

    it.each([
        ["struct", "struct CleanupError: Error {"],
        ["class", "final class LoaderError: NSObject, LocalizedError {"],
        ["actor", "actor QueueError: Error {"],
        ["CustomNSError only", "enum AutoconsentStatsError: CustomNSError {"],
        ["qualified protocol", "enum ParsingError: Swift.Error {"],
        ["attribute and modifiers", "@frozen public indirect enum TreeError: Error, Equatable {"],
        ["generic", "struct WrappedError<Underlying>: Error where Underlying: Sendable {"],
        ["extension", "extension SomeLegacyType: Error {}"],
        ["brace on the next line", "enum NetworkError: Error, LocalizedError // comment"],
    ])("warns for a new %s declaration", async (_name, declaration) => {
        setDiff(SOURCE_FILE, `\n+    ${declaration}\n`)

        await ddgErrorConformance()
        expect(dm.warn).toHaveBeenCalledTimes(1)
    })

    it("lists every new error type in a single warning", async () => {
        const otherFile = "macOS/DuckDuckGo/Feature/OtherFeature.swift"
        dm.danger.git.created_files = [otherFile]
        setDiff(SOURCE_FILE, `
+enum FirstError: Error {
+    case failed
+}
        `)
        setDiff(otherFile, `
+private enum SecondError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).toHaveBeenCalledTimes(1)
        expect(warnMessage()).toContain("enum FirstError: Error {")
        expect(warnMessage()).toContain("private enum SecondError: Error {")
        expect(warnMessage()).toContain(otherFile)
    })

    it("does not warn for a new type conforming to DDGError", async () => {
        setDiff(SOURCE_FILE, `
+public enum StartupError: DDGError {
+enum OtherError: Error, DDGError {
+extension LegacyError: DDGError.DDGError {}
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for types that are not errors", async () => {
        setDiff(SOURCE_FILE, `
+enum ErrorKind: String, Codable {
+struct ErrorView: View {
+extension ErrorReporter: Equatable {}
+    case failed(underlying: Error)
+    let error: Error
+    func handle(_ error: Error) {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for commented-out or removed declarations", async () => {
        setDiff(SOURCE_FILE, `
+// enum OldError: Error {
+    /// struct DocumentedError: Error {}
        `, `
-enum RemovedError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when an existing error type is edited", async () => {
        setDiff(SOURCE_FILE, `
+public enum StartupError: Error, CustomNSError, Equatable {
        `, `
-public enum StartupError: Error, CustomNSError {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn when an existing error type moves to another file", async () => {
        const oldFile = "SharedPackages/Feature/Sources/Feature/OldLocation.swift"
        dm.danger.git.modified_files = []
        dm.danger.git.created_files = [SOURCE_FILE]
        dm.danger.git.deleted_files = [oldFile]
        setDiff(SOURCE_FILE, `
+enum MovedError: Error {
        `)
        setDiff(oldFile, "", `
-enum MovedError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for test and mock files", async () => {
        const testFile = "SharedPackages/Feature/Tests/FeatureTests/FeatureServiceTests.swift"
        const mockFile = "iOS/DuckDuckGo/Feature/MockFeatureService.swift"
        dm.danger.git.modified_files = [testFile, mockFile]
        setDiff(testFile, `
+struct TestError: Error {}
        `)
        setDiff(mockFile, `
+enum MockError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn for non-Swift files", async () => {
        const markdownFile = "SharedPackages/DDGError/README.md"
        dm.danger.git.modified_files = [markdownFile]
        setDiff(markdownFile, `
+enum NetworkError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        setDiff(SOURCE_FILE, `
+enum StartupError: Error {
        `)

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("does not warn with no diff", async () => {
        dm.danger.git.diffForFile = async (_filename) => {}

        await ddgErrorConformance()
        expect(dm.warn).not.toHaveBeenCalled()
    })
})
