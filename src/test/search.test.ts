// src/test/search.test.ts
const { executeToolCall } = require('../tools/exec');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra', () => {
  const original = jest.requireActual('fs-extra');
  return {
    ...original,
    readdir: jest.fn().mockImplementation((dir) => {
      if (dir.endsWith('sub')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file2.js', isFile: () => true, isDirectory: () => false },
        { name: 'sub', isFile: () => false, isDirectory: () => true },
      ]);
    }),
    readFile: jest.fn().mockImplementation((filePath) => {
      if (filePath.endsWith('file1.ts')) {
        return Promise.resolve('class TestApp extends BaseClass {\n  constructor() {}\n}');
      }
      if (filePath.endsWith('file2.js')) {
        return Promise.resolve('const config = { host: "localhost" };');
      }
      if (filePath.includes('.gitignore') || filePath.includes('.dockerignore')) {
        return Promise.resolve('');
      }
      return Promise.reject(new Error('File not found'));
    }),
    writeFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockImplementation((filePath) => {
      if (filePath.endsWith('file1.ts')) {
        return Promise.resolve({ size: 1024 * 5, mtimeMs: Date.now() - 1000 * 60 * 10 }); // 5kb, modified 10m ago
      }
      if (filePath.endsWith('file2.js')) {
        return Promise.resolve({ size: 1024 * 50, mtimeMs: Date.now() - 1000 * 60 * 60 * 5 }); // 50kb, modified 5h ago
      }
      if (filePath.endsWith('sub')) {
        return Promise.resolve({ size: 0, mtimeMs: Date.now(), isDirectory: () => true });
      }
      return Promise.reject(new Error('File not found'));
    }),
  };
});

const fsMock = fs as unknown as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Search and Filter Tools', () => {
  it('grep_regex should match regex pattern on files', async () => {
    const result = await executeToolCall('grep_regex', {
      pattern: 'class\\s+\\w+\\s+extends',
      fileExtensions: ['ts'],
    });
    expect(result).toContain('file1.ts:1: class TestApp extends BaseClass');
    expect(result).not.toContain('file2.js');
  });

  it('grep_find_and_replace should modify matched files', async () => {
    const result = await executeToolCall('grep_find_and_replace', {
      findPattern: 'localhost',
      replacement: '127.0.0.1',
      fileExtensions: ['js'],
    });
    expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
    expect(fsMock.writeFile.mock.calls[0][1]).toContain('127.0.0.1');
    expect(result).toBe('Successfully modified 1 file(s).');
  });

  it('file_find_by_metadata should filter files by type, size and modtime', async () => {
    // Test size filtering (file1 is 5kb, file2 is 50kb)
    const result1 = await executeToolCall('file_find_by_metadata', {
      minSize: '1kb',
      maxSize: '10kb',
    });
    expect(result1).toContain('file1.ts');
    expect(result1).not.toContain('file2.js');

    // Test modification time filtering (file1 modified 10m ago, file2 modified 5h ago)
    const result2 = await executeToolCall('file_find_by_metadata', {
      modifiedWithin: '30m',
    });
    expect(result2).toContain('file1.ts');
    expect(result2).not.toContain('file2.js');
  });
});
