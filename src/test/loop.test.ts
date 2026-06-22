// src/test/loop.test.ts
import { executeShellCommand, completer } from '../chat/loop.js';
import { exec } from 'child_process';
import { setCwd } from '../tools/exec.js';

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, options, callback) => {
    setImmediate(() => callback(null, 'Mocked output', ''));
    return { pid: 123 };
  }),
  execFile: jest.fn((cmd, args, opts, callback) => {
    // If only 3 args, opts is the callback
    const cb = typeof opts === 'function' ? opts : callback;
    setImmediate(() => cb(null, { stdout: '', stderr: '' }));
  }),
  execFileSync: jest.fn(),
}));

jest.mock('../tools/exec.js', () => ({
  setCwd: jest.fn(),
}));

jest.mock('../config.js', () => ({
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
}));

describe('Chat Loop Completer', () => {
  test('completes commands starting with matching characters', () => {
    const [hits, line] = completer('/th');
    expect(line).toBe('/th');
    expect(hits).toContain('/theme');
    expect(hits.length).toBe(1);
  });

  test('returns multiple hits for common prefixes', () => {
    const [hits, line] = completer('/c');
    expect(line).toBe('/c');
    expect(hits).toContain('/compress');
    expect(hits).toContain('/clear');
    expect(hits).toContain('/copy');
    expect(hits).toContain('/cancel');
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });

  test('returns all completions if no match is found', () => {
    const [hits, line] = completer('/invalid');
    expect(line).toBe('/invalid');
    expect(hits).toContain('/model');
    expect(hits).toContain('/exit');
    expect(hits).toContain('/status');
    expect(hits.length).toBeGreaterThan(10);
  });

  test('returns matching completions for /s', () => {
    const [hits, line] = completer('/s');
    expect(line).toBe('/s');
    expect(hits).toContain('/status');
    expect(hits).toContain('/suggest');
    expect(hits).toContain('/save');
    expect(hits).toContain('/skills');
  });
});

describe('executeShellCommand', () => {
  let originalChdir: any;
  let originalStdoutWrite: any;
  let originalStderrWrite: any;

  beforeAll(() => {
    originalChdir = process.chdir;
    process.chdir = jest.fn();
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = jest.fn();
    originalStderrWrite = process.stderr.write;
    process.stderr.write = jest.fn();
  });

  afterAll(() => {
    process.chdir = originalChdir;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles cd with absolute path', async () => {
    await executeShellCommand('cd /tmp');
    expect(process.chdir).toHaveBeenCalledWith('/tmp');
    expect(setCwd).toHaveBeenCalledWith(process.cwd());
  });

  test('handles cd with empty path or ~', async () => {
    await executeShellCommand('cd');
    expect(process.chdir).toHaveBeenCalledWith(process.env.HOME || '.');
  });

  test('delegates non-cd command to exec', async () => {
    await executeShellCommand('ls -la');
    expect(exec).toHaveBeenCalledTimes(1);
    expect((exec as unknown as jest.Mock).mock.calls[0][0]).toBe('ls -la');
    expect(process.stdout.write).toHaveBeenCalledWith('Mocked output');
  });

  test('blocks destructive command from running', async () => {
    await executeShellCommand('rm -rf /');
    expect(exec).not.toHaveBeenCalled();
  });
});
