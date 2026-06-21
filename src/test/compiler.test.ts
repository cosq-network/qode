// src/test/compiler.test.ts
const { executeToolCall } = require('../tools/exec');
const { execFile } = require('child_process');

jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    setImmediate(() => callback(null, `Mocked run: ${file} ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
}));

const execFileMock = execFile as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Compiler and Make Tools', () => {
  it('make_run should run make command with parameters', async () => {
    const result = await executeToolCall('make_run', {
      target: 'all',
      jobs: 4,
      makefile: 'Makefile.mk',
      variables: ['CC=clang', 'DEBUG=1'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('make');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '-f', 'Makefile.mk',
      '-j', '4',
      'CC=clang',
      'DEBUG=1',
      'all',
    ]);
    expect(result).toBe('Mocked run: make -f Makefile.mk -j 4 CC=clang DEBUG=1 all');
  });

  it('c_compile_file should call target compiler with flags', async () => {
    await executeToolCall('c_compile_file', {
      compiler: 'g++',
      srcFile: 'src/main.cpp',
      outFile: 'bin/app',
      includeDirs: ['include', 'src'],
      flags: ['-O3', '-std=c++20'],
      linkLibs: ['-lpthread'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('g++');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '-Iinclude',
      '-Isrc',
      '-O3',
      '-std=c++20',
      'src/main.cpp',
      '-o', 'bin/app',
      '-lpthread',
    ]);
  });

  it('c_analyze_code should execute check tools', async () => {
    await executeToolCall('c_analyze_code', {
      filePath: 'src/main.cpp',
      tool: 'cppcheck',
      extraArgs: ['--force'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('cppcheck');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '--enable=all',
      '--inconclusive',
      '--force',
      'src/main.cpp',
    ]);
  });
});
