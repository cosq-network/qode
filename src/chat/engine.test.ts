// src/chat/engine.test.ts
import { ChatEngine } from './engine.js';
import { loadConfig } from '../config.js';
import { findModel } from '../providers/models.js';
import { OpenAICompatProvider } from '../providers/openai-compat.js';
import { GeminiProvider } from '../providers/gemini.js';

// Mock configuration
jest.mock('../config', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    defaultModel: 'TestModel',
    providers: {
      'TestProvider': { apiKey: 'test-key' },
    },
    mcpServers: [],
  }),
}));

// Mock model finding
jest.mock('../providers/models', () => ({
  findModel: jest.fn().mockReturnValue({
    model: 'test-model',
    providerKey: 'TestProvider',
    providerName: 'TestProvider',
  }),
}));

jest.mock('../providers/openai-compat', () => ({
  OpenAICompatProvider: jest.fn().mockImplementation(() => ({
    providerName: 'TestProvider',
    modelName: 'test-model',
    maxContextTokens: 10000,
    countTokens: () => 0,
    chat: jest.fn().mockResolvedValue({ message: { content: 'ok' } }),
  })),
}));
jest.mock('../providers/gemini', () => ({
  GeminiProvider: jest.fn().mockImplementation(() => ({
    providerName: 'TestProvider',
    modelName: 'test-model',
    maxContextTokens: 10000,
    countTokens: () => 0,
    chat: jest.fn().mockResolvedValue({ message: { content: 'ok' } }),
  })),
}));

describe('ChatEngine', () => {
  it('should create a provider for a known model', async () => {
    const config = await loadConfig();
    const engine = new ChatEngine(config);
    const provider = await engine.createProvider('TestModel');
    expect(provider).toBeDefined();
    expect(provider.modelName).toBe('test-model');
  });

  it('should rebuild tools list (built‑in + MCP)', async () => {
    const config = await loadConfig();
    const engine = new ChatEngine(config);
    await engine.rebuildAllTools();
    const tools = engine.getTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
});
