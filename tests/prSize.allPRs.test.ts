jest.mock("danger", () => jest.fn())
import danger from 'danger'
const dm = danger as any;

import { prSize } from '../org/allPRs'

beforeEach(() => {
    dm.warn = jest.fn().mockReturnValue(true);
    
    dm.git = {
        modified_files: ['src/some/file.ts'],
        created_files: [],
        diffForFile: jest.fn().mockResolvedValue({ additions: 200 })
    };
})

describe("PR diff size checks", () => {
    it("does not warn with less than 500 added lines", async () => {
        dm.git.diffForFile.mockResolvedValue({ additions: 200 });
        
        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
    })

    it("warns with 500 or more added lines in non-excluded files", async () => {
        dm.git.modified_files = ['src/some/file.ts'];
        dm.git.created_files = ['src/another/file.ts'];
        dm.git.diffForFile.mockResolvedValue({ additions: 250 }); // 2 files * 250 = 500 lines

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has 500 lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.')
    })

    it("does not warn when all modified files are excluded", async () => {
        dm.git.modified_files = [
            'Project.xcodeproj/something',
            'Assets.xcassets/image.png',
            'Project.xcworkspace/contents'
        ];
        dm.git.created_files = ['Another.xcodeproj/something'];
        dm.git.diffForFile.mockResolvedValue({ additions: 1000 });

        await prSize()
        
        expect(dm.warn).not.toHaveBeenCalled()
        expect(dm.git.diffForFile).not.toHaveBeenCalled()
    })

    it("counts both modified and created files", async () => {
        dm.git.modified_files = ['src/file1.ts'];
        dm.git.created_files = ['src/file2.ts'];
        dm.git.diffForFile.mockResolvedValue({ additions: 300 }); // 2 files * 300 = 600 lines

        await prSize()
        
        expect(dm.warn).toHaveBeenCalledWith('PR has 600 lines of added code (excluding Xcode projects and assets). Consider splitting into smaller PRs if possible.')
        expect(dm.git.diffForFile).toHaveBeenCalledTimes(2)
        expect(dm.git.diffForFile).toHaveBeenCalledWith('src/file1.ts')
        expect(dm.git.diffForFile).toHaveBeenCalledWith('src/file2.ts')
    })
})


