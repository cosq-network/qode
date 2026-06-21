// src/test/slash_commands.test.ts

// Mock external ESM modules before any imports
jest.mock('inquirer', () => ({ prompt: jest.fn() }));
jest.mock('ora', () => ({
  default: jest.fn(() => ({
    start: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn()
    }))
  }))
}));

// Mock utilities before importing the code under test
jest.mock('../utils/spinner.js', () => ({
  runWithSpinner: jest.fn(async (_msg, fn) => await fn())
}));
jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Mock child_process exec
jest.mock('child_process', () => ({ exec: jest.fn() as any }));

import { setKey, clearKey, handleSlashCommand, downloadQwenModel } from '../commands/slash.js';
import { loadConfig, saveConfig } from '../config.js';
import { exec } from 'child_process';

describe('Slash command utilities', () => {
  const testProvider = 'OpenAI';
  const testKey = 'sk-test-key';

  beforeAll(async () => {
    // start from a clean config
    await saveConfig({ providers: {} } as any);
  });

  test('setKey updates config', async () => {
    await setKey(testProvider, testKey);
    const cfg = await loadConfig();
    expect(cfg.providers?.[testProvider]?.apiKey).toBe(testKey);
  });

  test('clearKey removes key', async () => {
    await setKey(testProvider, testKey);
    await clearKey(testProvider);
    const cfg = await loadConfig();
    expect(cfg.providers?.[testProvider]?.apiKey).toBeUndefined();
  });

  test('handleSlashCommand parses /set-key', async () => {
    const command = `/set-key ${testProvider} ${testKey}`;
    const handled = await handleSlashCommand(command);
    expect(handled).toBe(true);
    const cfg = await loadConfig();
    expect(cfg.providers?.[testProvider]?.apiKey).toBe(testKey);
  });

  test('downloadQwenModel runs spinner and exec', async () => {
    (exec as unknown as jest.Mock).mockImplementation((_cmd: string, cb: Function) =>
      cb(null, { stdout: '', stderr: '' })
    );
    await downloadQwenModel();
    const { runWithSpinner } = require('../utils/spinner.js');
    expect(runWithSpinner).toHaveBeenCalled();
    expect(exec).toHaveBeenCalled();
  });
});
