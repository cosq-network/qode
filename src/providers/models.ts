import { loadConfig } from '../config.js';

// Default free models from the user's JSON
const DEFAULT_MODELS: Record<string, string[]> = {
  'Google AI Studio': ['Gemini 3.1 Pro Preview', 'Gemini 2.5 Flash'],
  'GitHub Models': ['DeepSeek-R1', 'o4-mini', 'Llama-4-Scout-17B'],
  'DeepSeek API': ['DeepSeek V4-Pro', 'DeepSeek V4-Flash'],
  'OpenRouter': ['Laguna M.1 (Poolside)', 'Qwen3-Coder', 'gpt-oss-120b'],
  'GroqCloud': ['Qwen3 (32B)', 'Llama 4 Scout (17B)'],
};

export async function listModels(): Promise<void> {
  const config = await loadConfig();
  console.log('\nAvailable models by provider:\n');
  for (const [provider, models] of Object.entries(DEFAULT_MODELS)) {
    const hasKey = !!config.providers[provider]?.apiKey;
    console.log(`${provider} ${hasKey ? '✓' : '✗ (no API key)'}`);
    models.forEach((m) => console.log(`  - ${m}`));
  }
}

export async function updateModels(): Promise<void> {
  console.log('Fetching live model lists from provider APIs...');
  // This would need real implementations per provider. For brevity, fallback.
  console.log('(Not implemented in this example – using built-in list)');
  listModels();
}

// Helper to get provider instance for a given model
export function findModel(modelName: string): { providerKey: string; model: string } | null {
  for (const [provider, models] of Object.entries(DEFAULT_MODELS)) {
    if (models.includes(modelName)) return { providerKey: provider, model: modelName };
  }
  return null;
}