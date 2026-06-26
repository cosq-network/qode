import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { updateShellEnvironment } from '../tools/echo/index.js';

describe('echo shell environment tool', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qode-echo-test-'));
  });

  afterEach(async () => {
    await fs.remove(homeDir);
  });

  test('writes managed env export blocks for bash and zsh', async () => {
    const result = await updateShellEnvironment({
      action: 'set_env',
      variable: 'QODE_HOME',
      value: '/opt/qode',
      shells: ['bash', 'zsh'],
      homeDir,
    });

    expect(result.error).toBeUndefined();
    expect(result.output).toContain('Changed:');
    await expect(fs.readFile(path.join(homeDir, '.bashrc'), 'utf8')).resolves.toContain("export QODE_HOME='/opt/qode'");
    await expect(fs.readFile(path.join(homeDir, '.zshrc'), 'utf8')).resolves.toContain("export QODE_HOME='/opt/qode'");
  });

  test('updates an existing managed block instead of duplicating it', async () => {
    await updateShellEnvironment({
      action: 'set_env',
      variable: 'QODE_HOME',
      value: '/old',
      shells: ['zsh'],
      homeDir,
    });

    await updateShellEnvironment({
      action: 'set_env',
      variable: 'QODE_HOME',
      value: '/new',
      shells: ['zsh'],
      homeDir,
    });

    const content = await fs.readFile(path.join(homeDir, '.zshrc'), 'utf8');
    expect(content).toContain("export QODE_HOME='/new'");
    expect(content).not.toContain("export QODE_HOME='/old'");
    expect(content.match(/# >>> qode echo set_env/g)).toHaveLength(1);
  });

  test('prepends path entries with shell-safe quoting', async () => {
    const result = await updateShellEnvironment({
      action: 'add_path',
      pathEntry: "/opt/qode's bin",
      shells: ['bash'],
      homeDir,
    });

    expect(result.error).toBeUndefined();
    const content = await fs.readFile(path.join(homeDir, '.bashrc'), 'utf8');
    expect(content).toContain("export PATH='/opt/qode'\\''s bin':\"$PATH\"");
  });

  test('rejects invalid variable names', async () => {
    const result = await updateShellEnvironment({
      action: 'set_env',
      variable: '1BAD',
      value: 'value',
      homeDir,
    });

    expect(result.error).toContain('valid shell environment variable name');
  });
});
