// src/test/files.test.ts
import fs from 'fs-extra';
import path from 'path';
import { getRecentFiles } from '../utils/files.js';

jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Recent Files Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('walks directories and returns top 5 sorted by modification time', async () => {
    const cwd = '/workspace';

    // Mock .gitignore check to return false
    (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
      return p.endsWith('.gitignore');
    });

    (mockedFs.readFile as any).mockImplementation(async (p: string) => {
      if (p.endsWith('.gitignore')) {
        return 'temp*\nignored-dir/';
      }
      throw new Error('Not found');
    });

    // Mock readdir
    (mockedFs.readdir as any).mockImplementation(async (p: string) => {
      if (p === cwd) {
        return [
          { name: 'fileA.txt', isDirectory: () => false, isFile: () => true },
          { name: 'fileB.ts', isDirectory: () => false, isFile: () => true },
          { name: 'ignored-dir', isDirectory: () => true, isFile: () => false },
          { name: 'sub', isDirectory: () => true, isFile: () => false },
          { name: 'tempFile.log', isDirectory: () => false, isFile: () => true },
        ];
      }
      if (p === path.join(cwd, 'sub')) {
        return [
          { name: 'fileC.json', isDirectory: () => false, isFile: () => true },
          { name: 'fileD.py', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });

    // Mock stats
    (mockedFs.stat as any).mockImplementation(async (p: string) => {
      if (p.endsWith('fileA.txt')) return { mtimeMs: 1000 };
      if (p.endsWith('fileB.ts')) return { mtimeMs: 5000 };
      if (p.endsWith('fileC.json')) return { mtimeMs: 2000 };
      if (p.endsWith('fileD.py')) return { mtimeMs: 4000 };
      return { mtimeMs: 0 };
    });

    const recent = await getRecentFiles(cwd, 3);
    // Sort expectation (descending mtimeMs):
    // fileB.ts (5000) -> fileD.py (4000) -> fileC.json (2000) -> fileA.txt (1000)
    // and tempFile.log and ignored-dir/ are excluded by gitignore/default rules.
    expect(recent).toHaveLength(3);
    expect(recent[0]).toBe('fileB.ts');
    expect(recent[1]).toBe('sub/fileD.py');
    expect(recent[2]).toBe('sub/fileC.json');
  });
});
