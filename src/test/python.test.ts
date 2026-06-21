// src/test/python.test.ts
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

describe('Python Tools', () => {
  it('python_create_venv should create venv', async () => {
    const result = await executeToolCall('python_create_venv', { venvPath: '.venv_test' });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('python3');
    expect(execFileMock.mock.calls[0][1]).toEqual(['-m', 'venv', '.venv_test']);
    expect(result).toContain('Virtual environment created at .venv_test');
  });

  it('python_install_requirements should call pip install', async () => {
    await executeToolCall('python_install_requirements', {
      venvPath: '.venv_test',
      packages: ['flask', 'pytest'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('pip');
    expect(execFileMock.mock.calls[0][1]).toEqual(['install', 'flask', 'pytest']);

    jest.clearAllMocks();

    await executeToolCall('python_install_requirements', {
      venvPath: '.venv_test',
      requirementsFile: 'requirements-dev.txt',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('pip');
    expect(execFileMock.mock.calls[0][1]).toEqual(['install', '-r', 'requirements-dev.txt']);
  });

  it('python_list_packages should call pip list', async () => {
    const result = await executeToolCall('python_list_packages', { venvPath: '.venv_test' });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('pip');
    expect(execFileMock.mock.calls[0][1]).toEqual(['list']);
    expect(result).toBe('Mocked run: ' + execFileMock.mock.calls[0][0] + ' list');
  });

  it('python_run_file should run script with args', async () => {
    await executeToolCall('python_run_file', {
      venvPath: '.venv_test',
      filePath: 'src/app.py',
      args: ['--debug'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toContain('python');
    expect(execFileMock.mock.calls[0][1]).toEqual(['src/app.py', '--debug']);
  });
});
