// src/test/cmake.test.ts
const { executeToolCall } = require('../tools/exec');
const { execFile } = require('child_process');
const fs = require('fs-extra');

jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    setImmediate(() => callback(null, `Mocked build run: ${file} ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
}));

jest.mock('fs-extra', () => ({
  remove: jest.fn().mockResolvedValue(undefined),
}));

const execFileMock = execFile as unknown as jest.Mock;
const fsMock = fs as unknown as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CMake and Ninja Tools', () => {
  it('cmake_configure should generate project files', async () => {
    const result = await executeToolCall('cmake_configure', {
      sourceDir: '.',
      buildDir: 'my_build',
      buildType: 'Release',
      generator: 'Ninja',
      cmakeArgs: ['-DBUILD_TESTS=ON'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('cmake');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '-S', '.',
      '-B', 'my_build',
      '-G', 'Ninja',
      '-DCMAKE_BUILD_TYPE=Release',
      '-DBUILD_TESTS=ON',
    ]);
    expect(result).toContain('cmake -S . -B my_build -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTS=ON');
  });

  it('cmake_build should run cmake build with options', async () => {
    await executeToolCall('cmake_build', {
      buildDir: 'my_build',
      target: 'my_target',
      parallel: true,
      cleanFirst: true,
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('cmake');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '--build', 'my_build',
      '--clean-first',
      '--parallel',
      '--target', 'my_target',
    ]);
  });

  it('cmake_run_tests should run ctest with patterns', async () => {
    await executeToolCall('cmake_run_tests', {
      buildDir: 'my_build',
      testNamePattern: 'Math*',
      parallelJobs: 4,
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('ctest');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '--test-dir', 'my_build',
      '-R', 'Math*',
      '-j', '4',
    ]);
  });

  it('cmake_clean should support target clean and directory delete', async () => {
    // Normal clean
    await executeToolCall('cmake_clean', { buildDir: 'my_build', pristineRebuild: false });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][1]).toEqual(['--build', 'my_build', '--target', 'clean']);

    jest.clearAllMocks();

    // Pristine rebuild clean
    const result = await executeToolCall('cmake_clean', { buildDir: 'my_build', pristineRebuild: true });
    expect(fsMock.remove).toHaveBeenCalledTimes(1);
    expect(result).toContain('successfully removed');
  });
});
