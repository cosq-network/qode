import { findModel, getModelCompletionEntries, DEFAULT_MODELS } from '../providers/models.js';
import { resolveAuthProviderName } from '../auth/providers.js';

describe('provider catalog', () => {
  test('resolves friendly model labels to API model ids', () => {
    expect(findModel('Gemini 2.5 Flash')).toMatchObject({
      providerKey: 'Google AI Studio',
      model: 'gemini-2.5-flash',
      runtime: 'gemini',
    });

    expect(findModel('DeepSeek V4-Pro')).toMatchObject({
      providerKey: 'DeepSeek API',
      model: 'deepseek-reasoner',
      runtime: 'openai-compatible',
    });
  });

  test('resolves model ids directly', () => {
    expect(findModel('glm-4.5-flash')).toMatchObject({
      providerKey: 'Z.ai',
      model: 'glm-4.5-flash',
      baseURL: 'https://api.z.ai/api/paas/v4',
    });
  });

  test('normalizes opencode to OpenCode Zen credentials', () => {
    expect(resolveAuthProviderName('opencode')).toBe('OpenCode Zen');
    expect(findModel('big-pickle')).toMatchObject({
      providerKey: 'OpenCode Zen',
      model: 'big-pickle',
      runtime: 'opencode',
    });
  });

  test('model completions use API ids while default models use labels', () => {
    expect(DEFAULT_MODELS['Google AI Studio']).toContain('Gemini 2.5 Flash');
    expect(getModelCompletionEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'gemini-2.5-flash', provider: 'Google AI Studio' }),
      expect.objectContaining({ value: 'gpt-5.4-mini', provider: 'OpenAI' }),
    ]));
  });
});
