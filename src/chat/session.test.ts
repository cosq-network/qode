// src/chat/session.test.ts
import { Session } from './session.js';
import { LLMProvider } from '../providers/base.js';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';

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
class MockProvider implements LLMProvider {
  providerName = 'MockProvider';
  modelName = 'mock-model';
  maxContextTokens = 10;
  countTokens = jest.fn().mockReturnValue(3);
  chat = jest.fn().mockResolvedValue({ message: { content: 'response' } });
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
    // At this point totalTokens = 5*3 = 15 > limit 5, compression should run
    await session.compressIfNeeded();
    // After compression, messages should contain system, summary, and last 4 messages (max 6 total)
    expect(session.messages.length).toBeLessThanOrEqual(6);
    // The first message remains system prompt
    expect(session.messages[0].role).toBe('system');
    // Summary should be a system message containing "Previous conversation summary"
    expect(session.messages[1].role).toBe('system');
    expect((session.messages[1].content as string)).toContain('Previous conversation summary');
  });
});
