jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const mockAuthManager = {
  showStatus: jest.fn(async () => undefined),
  connectProvider: jest.fn(async () => true),
  disconnectProvider: jest.fn(async () => true),
};

jest.mock('../auth/manager.js', () => ({
  getAuthManager: () => mockAuthManager,
}));

const mockConfig = { providers: {} as Record<string, { apiKey?: string }> };
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(async () => undefined),
  pathExists: jest.fn(async (_p: string) => {
    if (_p.endsWith('status.json')) return false;
    if (_p.endsWith('.gguf')) return false;
    return false;
  }),
  readJson: jest.fn(async () => mockConfig),
  writeJson: jest.fn(async (_path: string, value: any) => {
    mockConfig.providers = value.providers ?? {};
  }),
  stat: jest.fn(async () => ({ size: 1024 })),
  readdir: jest.fn(async () => []),
}));

import { setKey, clearKey, handleSlashCommand } from '../commands/slash.js';
import { loadConfig, saveConfig } from '../config.js';

describe('Slash command utilities', () => {
  const testProvider = 'OpenAI';
  const testKey = 'sk-test-key';

  beforeAll(async () => {
    mockConfig.providers = {};
    await saveConfig({ providers: {} } as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

  test('handleSlashCommand shows /auth status', async () => {
    const handled = await handleSlashCommand('/auth status');
    expect(handled).toBe(true);
    expect(mockAuthManager.showStatus).toHaveBeenCalledTimes(1);
  });

  test('handleSlashCommand connects provider with friendly alias', async () => {
    const handled = await handleSlashCommand('/auth set gemini');
    expect(handled).toBe(true);
    expect(mockAuthManager.connectProvider).toHaveBeenCalledWith('Google AI Studio');
  });

  test('handleSlashCommand accepts provider display names with spaces', async () => {
    const handled = await handleSlashCommand('/auth set Google AI Studio');
    expect(handled).toBe(true);
    expect(mockAuthManager.connectProvider).toHaveBeenCalledWith('Google AI Studio');
  });

  test('handleSlashCommand clears provider with friendly alias', async () => {
    const handled = await handleSlashCommand('/auth clear openai');
    expect(handled).toBe(true);
    expect(mockAuthManager.disconnectProvider).toHaveBeenCalledWith('OpenAI');
  });

  test('handleSlashCommand supports /connect alias', async () => {
    const handled = await handleSlashCommand('/connect anthropic');
    expect(handled).toBe(true);
    expect(mockAuthManager.connectProvider).toHaveBeenCalledWith('Anthropic');
  });

  test('handleSlashCommand handles /models', async () => {
    const handled = await handleSlashCommand('/models');
    expect(handled).toBe(true);
  });
});
