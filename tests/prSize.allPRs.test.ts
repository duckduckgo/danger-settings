jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { prSize } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);

    dm.danger = {
        git: {
            modified_files: ['src/some/file.ts'],
            created_files: [],
            diffForFile: jest.fn().mockResolvedValue({ added: '1\n'.repeat(200) })
        }
    }
})

describe("PR diff size checks", () => {
    it("does not warn with less than 500 added lines", async () => {
        dm.danger.git.diffForFile.mockResolvedValue({ added: '1\n'.repeat(200) }); // 200 lines
        
        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with 500 or more added lines in non-excluded files", async () => {
        dm.danger.git.modified_files = ['src/some/file.ts'];
        dm.danger.git.created_files = ['src/another/file.ts'];
        dm.danger.git.diffForFile.mockResolvedValue({ added: '1\n'.repeat(250) }); // 2 files * 250 = 500 lines

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has 500 lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.')
    })

    it("does not warn when all modified files are excluded", async () => {
        dm.danger.git.modified_files = [
            'Project.xcodeproj/something',
            'Assets.xcassets/image.png',
            'Project.xcworkspace/contents'
        ];
        dm.danger.git.created_files = ['Another.xcodeproj/something'];
        dm.danger.git.diffForFile.mockResolvedValue({ added: '1\n'.repeat(1000) });

        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
        expect(dm.danger.git.diffForFile).not.toHaveBeenCalled()
    })

    it("counts both modified and created files", async () => {
        dm.danger.git.modified_files = ['src/file1.ts'];
        dm.danger.git.created_files = ['src/file2.ts'];
        dm.danger.git.diffForFile.mockResolvedValue({ added: '1\n'.repeat(300) }); // 2 files * 300 = 600 lines

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has 600 lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.')
        expect(dm.danger.git.diffForFile).toHaveBeenCalledTimes(2)
        expect(dm.danger.git.diffForFile).toHaveBeenCalledWith('src/file1.ts')
        expect(dm.danger.git.diffForFile).toHaveBeenCalledWith('src/file2.ts')
    })
})