jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

jest.mock("child_process", () => ({ execFileSync: jest.fn() }))
import { execFileSync } from 'child_process'
const execFileSyncMock = execFileSync as jest.Mock;

import { pixelPrivacyGate } from '../org/allPRs'

const PIXEL_FILE = "iOS/DuckDuckGo/SamplePixel.swift"
const DEFINITIONS_FILE = "iOS/PixelDefinitions/pixels/definitions/sample.json5"

const PIXEL_SOURCE = `import PixelKit

enum SamplePixel: PixelKit.Event {
    case shown
    case tapped(source: String)

    var name: String {
        switch self {
        case .shown: return "sample_shown"
        case .tapped: return "sample_tapped"
        }
    }
}

struct SampleView {
    let title = "Hello { world"
}
`

type Change = { type: "add" | "del", ln: number, content: string }
type FakeFile = { before?: string, after?: string, changes: Change[], fromPath?: string }

let files: Record<string, FakeFile>

const added = (ln: number, content: string): Change => ({ type: "add", ln, content: `+${content}` })
const removed = (ln: number, content: string): Change => ({ type: "del", ln, content: `-${content}` })

function givenFiles(newFiles: Record<string, FakeFile>) {
    files = newFiles
    dm.danger.git.modified_files = Object.keys(newFiles)
}

function givenLabels(...names: string[]) {
    dm.danger.github.issue.labels = names.map(name => ({ name }))
}

function failMessages(): string[] {
    return dm.fail.mock.calls.map(call => call[0] as string)
}

beforeEach(() => {
    files = {}
    execFileSyncMock.mockReset()
    execFileSyncMock.mockReturnValue("")
    dm.fail = jest.fn().mockReturnValue(true);
    dm.message = jest.fn().mockReturnValue(true);
    dm.markdown = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            base: "base-sha",
            modified_files: [],
            created_files: [],
            deleted_files: [],
            diffForFile: async (file) => {
                const fake = files[file]
                if (!fake) return null
                const lines = (type) => fake.changes.filter(c => c.type === type).map(c => c.content).join("\n")
                return { before: fake.before ?? "", after: fake.after ?? "", added: lines("add"), removed: lines("del") }
            },
            structuredDiffForFile: async (file) => {
                const fake = files[file]
                return fake ? { chunks: [{ changes: fake.changes }], fromPath: fake.fromPath ?? file } : null
            },
        },
        github: {
            thisPR: { repo: "apple-browsers" },
            issue: { labels: [] },
            utils: { fileContents: async () => "" },
        },
    }
})

describe("pixel privacy gate", () => {
    it("does nothing outside the apple-browsers repo", async () => {
        dm.danger.github.thisPR.repo = "iOS"
        givenFiles({ [PIXEL_FILE]: { after: PIXEL_SOURCE, changes: [added(4, "    case shown")] } })

        await pixelPrivacyGate()
        expect(dm.fail).not.toHaveBeenCalled()
    })

    it("does nothing when no pixels change", async () => {
        givenFiles({ "iOS/DuckDuckGo/Other.swift": { after: "struct Other {}", changes: [added(1, "struct Other {}")] } })

        await pixelPrivacyGate()
        expect(dm.fail).not.toHaveBeenCalled()
        expect(dm.markdown).not.toHaveBeenCalled()
    })

    describe("detection", () => {
        it("fails when a pixel name changes without a definitions update", async () => {
            givenLabels("privacy review required")
            givenFiles({ [PIXEL_FILE]: {
                before: PIXEL_SOURCE, after: PIXEL_SOURCE,
                changes: [removed(9, `        case .shown: return "sample_shown"`), added(9, `        case .shown: return "sample_displayed"`)],
            } })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
            expect(failMessages()[0]).toContain("PixelDefinitions")
            expect(failMessages()[0]).toContain("skip pixel check")
        })

        it("ignores changes outside pixel types", async () => {
            givenFiles({ [PIXEL_FILE]: { before: PIXEL_SOURCE, after: PIXEL_SOURCE, changes: [added(16, `    let title = "Hi"`)] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("ignores braces inside string literals when finding the type body", async () => {
            givenFiles({ [PIXEL_FILE]: { before: PIXEL_SOURCE, after: PIXEL_SOURCE, changes: [added(17, "}")] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("ignores comments and test files", async () => {
            givenFiles({
                [PIXEL_FILE]: { after: PIXEL_SOURCE, changes: [added(4, "    // a comment")] },
                "iOS/DuckDuckGoTests/SamplePixelTests.swift": { after: PIXEL_SOURCE, changes: [added(4, "    case shown")] },
            })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("ignores a pixel type moved to another file", async () => {
            givenFiles({
                "iOS/Old.swift": { before: PIXEL_SOURCE, changes: [removed(4, "    case shown")] },
                "iOS/New.swift": { after: PIXEL_SOURCE, changes: [added(4, "    case shown")] },
            })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("detects extensions of pixel types declared in other files", async () => {
            execFileSyncMock.mockReturnValue("enum SamplePixel: PixelKit.Event {")
            const extensionSource = `extension SamplePixel {\n    var parameters: [String: String]? { ["source": "x"] }\n}\n`
            givenLabels("privacy review required")
            givenFiles({ "iOS/SamplePixel+Parameters.swift": { after: extensionSource, changes: [added(2, `    var parameters: [String: String]? { ["source": "x"] }`)] } })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
        })

        it("does not treat generic constraints as pixel types", async () => {
            const source = `final class Recorder<Data: WideEventData> {\n    func record() { print("x") }\n}\n`
            givenFiles({ "SharedPackages/Recorder.swift": { after: source, changes: [added(2, `    func record() { print("x") }`)] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("detects the iOS Pixel.Event enum", async () => {
            const source = `extension Pixel {\n    public enum Event {\n        case appLaunch\n    }\n}\n`
            givenLabels("privacy review required")
            givenFiles({ "iOS/Core/PixelEvent.swift": { after: source, changes: [added(3, "        case appLaunch")] } })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
        })

        it("ignores a call site migrated to another firing API with the same parameter keys", async () => {
            givenFiles({ "macOS/Model.swift": { changes: [
                removed(10, `        PixelKit.fire(SamplePixel.shown, withAdditionalParameters: ["source": source.rawValue])`),
                added(10, `        pixelFiring?.fire(SamplePixel.shown, options: .parameters(["source": source]))`),
            ] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("ignores a call site migrated to a firing API that attaches the error to the event", async () => {
            givenFiles({ "iOS/Model.swift": { changes: [
                removed(10, `        Pixel.fire(pixel: .fileStoreWriteFailed, error: error, withAdditionalParameters: ["config": config])`),
                added(10, `        PixelKit.fire(Pixel.Event.fileStoreWriteFailed.withError(error), options: .parameters(["config": config]))`),
            ] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("tells events with associated values apart", async () => {
            givenLabels("privacy review required")
            givenFiles({ ...{ [DEFINITIONS_FILE]: { changes: [added(1, `"sample": {`)] } }, "iOS/Model.swift": { changes: [
                removed(10, `        Pixel.fire(pixel: .appLaunchTime(time: bucket), withAdditionalParameters: params)`),
                added(10, `        PixelKit.fire(Pixel.Event.appShowTime(time: bucket), options: .parameters(params))`),
            ] } })

            await pixelPrivacyGate()
            expect(dm.markdown.mock.calls[0][0]).toContain("appShowTime")
        })

        it("compares a call site split over several lines as a whole", async () => {
            givenFiles({ "iOS/Model.swift": { changes: [
                removed(10, `        Pixel.fire(pixel: .syncLogin,`),
                removed(11, `                   withAdditionalParameters: parameters,`),
                removed(12, `                   includedParameters: [.appVersion])`),
                added(10, `        PixelKit.fire(Pixel.Event.syncLogin, options: .parameters(parameters))`),
            ] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("ignores declarations of pixel firing functions", async () => {
            givenFiles({ "iOS/Core/PixelFiring.swift": { changes: [
                removed(10, `    func fire(pixel: Pixel.Event, withAdditionalParameters params: [String: String]) {`),
            ] } })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("detects a call site that sends a new parameter key", async () => {
            givenLabels("privacy review required")
            givenFiles({ "iOS/Model.swift": { changes: [
                removed(10, `        Pixel.fire(pixel: .appLaunch, withAdditionalParameters: ["source": source])`),
                added(10, `        Pixel.fire(pixel: .appLaunch, withAdditionalParameters: ["source": source, "user": id])`),
            ] } })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
        })
    })

    describe("rules", () => {
        const pixelCodeChange = { [PIXEL_FILE]: { after: PIXEL_SOURCE, changes: [added(4, "    case shown")] } }
        const pixelCodeRemoval = { [PIXEL_FILE]: { before: PIXEL_SOURCE, changes: [removed(4, "    case shown")] } }
        const definitionsChange = { [DEFINITIONS_FILE]: { changes: [added(1, `"sample_shown": {`)] } }
        const definitionsRemoval = { [DEFINITIONS_FILE]: { changes: [removed(1, `"sample_shown": {`)] } }

        it("fails without the privacy label when pixel code and definitions change", async () => {
            givenFiles({ ...pixelCodeChange, ...definitionsChange })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
            expect(failMessages()[0]).toContain("privacy review required")
        })

        it("passes with the privacy label and reminds to check the definitions", async () => {
            givenLabels("privacy review required")
            givenFiles({ ...pixelCodeChange, ...definitionsChange })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
            expect(dm.markdown.mock.calls[0][0]).toContain("reflected in the definitions")
            expect(dm.markdown.mock.calls[0][0]).toContain("case shown")
            expect(dm.markdown.mock.calls[0][0]).toContain("let us know](https://app.asana.com/")
        })

        it("fails for definitions-only changes without the label, explaining the bypass", async () => {
            givenFiles(definitionsChange)

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
            expect(failMessages()[0]).toContain("skip pixel check")
        })

        it("asks about the definitions when code only loses pixels but the definitions gain lines", async () => {
            givenFiles({ ...pixelCodeRemoval, ...definitionsChange })

            await pixelPrivacyGate()
            expect(failMessages()).toHaveLength(1)
            expect(failMessages()[0]).toContain("Pixel definitions changed")
        })

        it("does not require the privacy label for removing pixels", async () => {
            givenFiles({ ...pixelCodeRemoval, ...definitionsRemoval })

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("lists files that only remove pixel code with a count instead of their lines", async () => {
            givenFiles({ ...pixelCodeRemoval, ...definitionsRemoval })

            await pixelPrivacyGate()
            const report = dm.markdown.mock.calls[0][0]
            expect(report).toContain(`- \`${PIXEL_FILE}\` −1`)
            expect(report).not.toContain("```diff")
        })

        it("shows both sides of an edit so renamed pixels keep their old name", async () => {
            givenLabels("privacy review required")
            givenFiles({ ...definitionsChange, [PIXEL_FILE]: {
                before: PIXEL_SOURCE, after: PIXEL_SOURCE,
                changes: [removed(9, `        case .shown: return "sample_shown"`), added(9, `        case .shown: return "sample_displayed"`)],
            } })

            await pixelPrivacyGate()
            expect(dm.markdown.mock.calls[0][0]).toContain(`- case .shown: return "sample_shown"\n+ case .shown: return "sample_displayed"`)
        })

        it("collapses long snippets and cuts them off", async () => {
            givenLabels("privacy review required")
            const longSource = `enum SamplePixel: PixelKit.Event {\n${Array.from({ length: 40 }, (_, i) => `    case event${i}`).join("\n")}\n}\n`
            givenFiles({ ...definitionsChange, [PIXEL_FILE]: {
                after: longSource,
                changes: Array.from({ length: 40 }, (_, i) => added(i + 2, `    case event${i}`)),
            } })

            await pixelPrivacyGate()
            const report = dm.markdown.mock.calls[0][0]
            expect(report).toContain("<details><summary>")
            expect(report).toContain("… 10 more lines.")
        })

        it("links each file to its place in the PR diff", async () => {
            givenLabels("privacy review required")
            dm.danger.github.pr = { html_url: "https://github.com/duckduckgo/apple-browsers/pull/1" }
            givenFiles({ ...pixelCodeChange, ...definitionsChange })

            await pixelPrivacyGate()
            expect(dm.markdown.mock.calls[0][0]).toContain(
                "[View in the diff](https://github.com/duckduckgo/apple-browsers/pull/1/files#diff-" +
                require("crypto").createHash("sha256").update(PIXEL_FILE).digest("hex") + ")"
            )
        })

        it("bypasses both rules with the skip label", async () => {
            givenLabels("skip pixel check")
            givenFiles(pixelCodeChange)

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })

        it("bypasses the privacy label requirement for definitions-only fixes with the skip label", async () => {
            givenLabels("skip pixel check")
            givenFiles(definitionsChange)

            await pixelPrivacyGate()
            expect(dm.fail).not.toHaveBeenCalled()
        })
    })
})
