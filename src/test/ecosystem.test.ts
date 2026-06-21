// src/test/ecosystem.test.ts
const { executeToolCall } = require('../tools/exec');
const { execFile } = require('child_process');
const fs = require('fs-extra');

jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    setImmediate(() => callback(null, `Mocked run: ${file} ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
}));

jest.mock('fs-extra', () => {
  const original = jest.requireActual('fs-extra');
  return {
    ...original,
    pathExists: jest.fn().mockImplementation((pathStr) => {
      // Return true if checking for gradlew to test local wrapper path
      if (pathStr.includes('gradlew')) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }),
  };
});

const execFileMock = execFile as unknown as jest.Mock;
const fsMock = fs as unknown as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Multi-Ecosystem Tools', () => {
  it('pip_show_package should show package metadata', async () => {
    await executeToolCall('pip_show_package', {
      packageName: 'flask',
      venvPath: '.venv_test',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('pip');
    expect(execFileMock.mock.calls[0][1]).toEqual(['show', 'flask']);
  });

  it('java_compile_and_run should compile files and run main class', async () => {
    // Compile
    await executeToolCall('java_compile_and_run', {
      action: 'compile',
      sourceFiles: ['src/App.java'],
      classPath: 'libs/*',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('javac');
    expect(execFileMock.mock.calls[0][1]).toEqual(['-cp', 'libs/*', 'src/App.java']);

    jest.clearAllMocks();

    // Run
    await executeToolCall('java_compile_and_run', {
      action: 'run',
      className: 'src.App',
      classPath: 'bin',
      args: ['--debug'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('java');
    expect(execFileMock.mock.calls[0][1]).toEqual(['-cp', 'bin', 'src.App', '--debug']);
  });

  it('java_project_build should build maven and gradle projects', async () => {
    // Maven
    await executeToolCall('java_project_build', {
      system: 'maven',
      target: 'clean compile',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('mvn');
    expect(execFileMock.mock.calls[0][1]).toEqual(['clean', 'compile']);

    jest.clearAllMocks();

    // Gradle
    await executeToolCall('java_project_build', {
      system: 'gradle',
      target: 'test',
    });
    expect(fsMock.pathExists).toHaveBeenCalled();
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('gradlew');
    expect(execFileMock.mock.calls[0][1]).toEqual(['test']);
  });

  it('dotnet_command should build and test .net apps', async () => {
    await executeToolCall('dotnet_command', {
      action: 'build',
      projectPath: 'src/App.csproj',
      configuration: 'Release',
      extraArgs: ['--no-restore'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('dotnet');
    expect(execFileMock.mock.calls[0][1]).toEqual(['build', 'src/App.csproj', '-c', 'Release', '--no-restore']);
  });

  it('flutter_command should build app bundles and run tasks', async () => {
    await executeToolCall('flutter_command', {
      action: 'build',
      buildTarget: 'apk',
      extraArgs: ['--release'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('flutter');
    expect(execFileMock.mock.calls[0][1]).toEqual(['build', 'apk', '--release']);
  });
});
