// src/chat/engine.test.ts
const { ChatEngine } = require('./engine');
const { loadConfig } = require('../config');

// Mock configuration
jest.mock('../config', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    defaultModel: 'TestModel',
    providers: { TestProvider: { apiKey: 'test-key' } },
    mcpServers: [],
  }),
}));

// Mock model finding
jest.mock('../providers/models', () => ({
  findModel: jest.fn().mockReturnValue({
    model: 'test-model',
    providerKey: 'TestProvider',
    providerName: 'TestProvider',
    runtime: 'openai-compatible',
    baseURL: 'https://example.test/v1',
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

// Mock the tools index (registry)
jest.mock('../tools/index', () => ({
  initializeTools: jest.fn(),
  globalRegistry: {
    getDefinitions: jest.fn().mockReturnValue([]),
    has: jest.fn().mockReturnValue(false),
    execute: jest.fn(),
  },
}));

describe('ChatEngine', () => {
  it('should create a provider for a known model', async () => {
    const config = await loadConfig();
    const engine = new ChatEngine(config);
    const provider = await engine.createProvider('TestModel');
    expect(provider).toBeDefined();
    expect(provider.modelName).toBe('test-model');
  });

  it('should rebuild tools list (built-in + MCP)', async () => {
    const config = await loadConfig();
    const engine = new ChatEngine(config);
    await engine.rebuildAllTools();
    const tools = engine.getTools();
    expect(Array.isArray(tools)).toBe(true);
    // The legacy TOOL_DEFINITIONS are still included as fallback
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should return undefined for maxToolCalls when not configured', async () => {
    const config = await loadConfig();
    const engine = new ChatEngine(config);
    expect(engine.getMaxToolCalls()).toBeUndefined();
  });

  it('should return configured maxToolCalls', async () => {
    const config = await loadConfig();
    config.maxToolCalls = 25;
    const engine = new ChatEngine(config);
    expect(engine.getMaxToolCalls()).toBe(25);
  });
});
