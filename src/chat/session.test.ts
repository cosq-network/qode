// src/chat/session.test.ts
const { Session } = require('./session');

// Mock logger to silence output during tests
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

// Mock config for compression
jest.mock('../config', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    autoCompress: true,
    compressThreshold: 0.5,
  }),
}));

// Simple mock provider
// Simple mock provider with explicit fields
class MockProvider {
  public providerName: string;
  public modelName: string;
  public maxContextTokens: number;
  public countTokens: jest.Mock;
  public chat: jest.Mock;
  constructor() {
    this.providerName = 'MockProvider';
    this.modelName = 'mock-model';
    this.maxContextTokens = 10;
    this.countTokens = jest.fn().mockReturnValue(3);
    this.chat = jest.fn().mockResolvedValue({ message: { content: 'response' } });
  }
}

describe('Session', () => {
  it('should inject provider and retain modelName', async () => {
    const session = new Session('sess1', 'mock-model');
    const provider = new MockProvider();
    session.setProvider(provider);
    expect(session.provider).toBe(provider);
    expect(session.modelName).toBe(provider.modelName);
  });

  it('compressIfNeeded should summarize when token limit exceeded', async () => {
    const session = new Session('sess2', 'mock-model');
    const provider = new MockProvider();
    session.setProvider(provider);
    // add many user messages to exceed token limit (limit = maxContextTokens * threshold = 5)
    for (let i = 0; i < 5; i++) {
      session.addMessage({ role: 'user', content: 'abc' });
    }
    await session.compressIfNeeded();
    expect(session.messages.length).toBeLessThanOrEqual(6);
    expect(session.messages[0].role).toBe('system');
    expect(session.messages[1].role).toBe('system');
    expect(session.messages[1].content).toContain('Previous conversation summary');
  });
});
