// src/test/node.test.ts
const { executeToolCall } = require('../tools/exec');
const { exec, execFile } = require('child_process');

jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    setImmediate(() => callback(null, `Mocked command run: ${file} ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
  exec: jest.fn((cmd, options, callback) => {
    // For node_get_info we need to return versions or default strings
    if (cmd.includes('-v')) {
      setImmediate(() => callback(null, 'v20.0.0', ''));
    } else {
      setImmediate(() => callback(null, `Mocked shell run: ${cmd}`, ''));
    }
    return { pid: 123 };
  }),
}));

const execFileMock = execFile as unknown as jest.Mock;
const execMock = exec as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Node and NPM Tools', () => {
  it('npm_list_dependencies should list packages', async () => {
    const result = await executeToolCall('npm_list_dependencies', {});
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('npm');
    expect(execFileMock.mock.calls[0][1]).toEqual(['list', '--depth=0']);
    expect(result).toBe('Mocked command run: npm list --depth=0');
  });

  it('npm_audit should run audit or audit fix', async () => {
    await executeToolCall('npm_audit', { fix: false });
    expect(execFileMock.mock.calls[0][1]).toEqual(['audit']);

    jest.clearAllMocks();

    await executeToolCall('npm_audit', { fix: true });
    expect(execFileMock.mock.calls[0][1]).toEqual(['audit', 'fix']);
  });

  it('npm_check_outdated should run npm outdated', async () => {
    await executeToolCall('npm_check_outdated', {});
    expect(execFileMock.mock.calls[0][1]).toEqual(['outdated']);
  });

  it('npm_run_script should run targeted scripts', async () => {
    await executeToolCall('npm_run_script', { scriptName: 'build' });
    expect(execFileMock.mock.calls[0][1]).toEqual(['run', 'build']);
  });

  it('node_run_file should run JS/TS file with params', async () => {
    await executeToolCall('node_run_file', {
      filePath: 'src/main.ts',
      args: ['--port', '8080'],
      useTsx: true,
    });
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock.mock.calls[0][0]).toContain('npx tsx');
    expect(execMock.mock.calls[0][0]).toContain('main.ts');
    expect(execMock.mock.calls[0][0]).toContain('"--port" "8080"');
  });

  it('node_get_info should aggregate node info', async () => {
    const result = await executeToolCall('node_get_info', {});
    expect(execMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result).toContain('Node.js: v20.0.0');
    expect(result).toContain('NPM: v20.0.0');
    expect(result).toContain('Yarn: v20.0.0');
  });
});
