import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { listLocalModels, formatSize } from '../models/downloader.js';
import { getAuthManager } from '../auth/manager.js';
import {
  PROVIDER_CATALOG,
  getProviderCatalog,
  type ProviderRuntime,
} from './catalog.js';

export interface ModelMatch {
  providerKey: string;
  model: string;
  label: string;
  runtime: ProviderRuntime;
  baseURL?: string;
}

export const DEFAULT_MODELS: Record<string, string[]> = Object.fromEntries(
  PROVIDER_CATALOG
    .filter((provider) => provider.models.length > 0)
    .map((provider) => [provider.key, provider.models.map((model) => model.label)]),
);

export function getModelCompletionEntries(): Array<{ provider: string; value: string; description: string }> {
  return PROVIDER_CATALOG.flatMap((provider) =>
    provider.models.map((model) => ({
      provider: provider.key,
      value: model.id,
      description: model.label === model.id ? provider.key : `${provider.key} · ${model.label}`,
    })),
  );
}

export async function listModels(): Promise<void> {
  const config = await loadConfig();
  const auth = getAuthManager();
  logger.info('\nAvailable models by provider:\n');

  for (const provider of PROVIDER_CATALOG.filter((entry) => entry.models.length > 0)) {
    const hasKey = !!config.providers[provider.key]?.apiKey || await auth.isConfigured(provider.key);
    logger.info(`${provider.key} ${hasKey ? '✓' : '✗ (no API key)'}`);
    for (const model of provider.models) {
      const label = model.label === model.id ? model.id : `${model.label} (${model.id})`;
      logger.info(`  - ${label}`);
    }
  }

  logger.info('\nLocal Models (llama.cpp):');
  const localCfg = config.localModel;
  const enabled = localCfg?.enabled ?? false;
  logger.info(`  Status: ${enabled ? '✓ enabled' : '✗ disabled (set localModel.enabled in config)'}`);

  try {
    const localModels = await listLocalModels();
    if (localModels.length === 0) {
      logger.info('  No models downloaded yet.');
    } else {
      for (const model of localModels) {
        const status = model.downloaded ? '✓' : '✗';
        const size = model.downloaded ? ` (${formatSize(model.size)})` : '';
        const quant = model.quantization ? ` [${model.quantization}]` : '';
        logger.info(`  ${status} ${model.name}${quant}${size}`);
      }
    }
  } catch {
    logger.info('  (unable to list local models)');
  }

  logger.info('\n  Use "local" as model name to use a local model.');
}

export async function updateModels(): Promise<void> {
  logger.info('Fetching live model lists from provider APIs...');
  logger.info('(Not implemented yet - using bundled provider catalog)');
  await listModels();
}

function modelMatches(input: string, candidate: string): boolean {
  return candidate.toLowerCase() === input.toLowerCase();
}

export function findModel(modelName: string): ModelMatch | null {
  const input = modelName.trim();
  if (!input) return null;

  for (const provider of PROVIDER_CATALOG) {
    for (const model of provider.models) {
      const candidates = [model.id, model.label, ...(model.aliases ?? [])];
      if (candidates.some((candidate) => modelMatches(input, candidate))) {
        return {
          providerKey: provider.key,
          model: model.id,
          label: model.label,
          runtime: provider.runtime,
          baseURL: provider.baseURL,
        };
      }
    }
  }
  return null;
}

export { PROVIDER_CATALOG, getProviderCatalog };
