import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { notify } from '../utils/notification.js';

const MODELS_DIR = path.join(os.homedir(), '.qode', 'models');
const STATUS_FILE = path.join(MODELS_DIR, 'status.json');

/** Metadata about a downloaded model. */
export interface ModelInfo {
  name: string;
  filename: string;
  size: number;
  quantization?: string;
  downloaded: boolean;
  downloadedAt?: string;
}

/** Status file structure. */
interface DownloadStatus {
  models: Record<string, { downloaded: boolean; timestamp: string; size: number }>;
}

/** Built-in model definitions. */
export const BUILTIN_MODELS: Array<{
  name: string;
  filename: string;
  url: string;
  quantization: string;
  contextSize: number;
}> = [
  {
    name: 'Qwen2.5-Coder-0.5B-Instruct',
    filename: 'qwen2.5-coder-0.5b-instruct.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct/resolve/main/qwen2.5-coder-0.5b-instruct.gguf',
    quantization: 'Q4_K_M',
    contextSize: 32768,
  },
  {
    name: 'Qwen2.5-Coder-1.5B-Instruct',
    filename: 'qwen2.5-coder-1.5b-instruct.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/resolve/main/qwen2.5-coder-1.5b-instruct.gguf',
    quantization: 'Q4_K_M',
    contextSize: 32768,
  },
  {
    name: 'Qwen2.5-Coder-3B-Instruct',
    filename: 'qwen2.5-coder-3b-instruct.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct/resolve/main/qwen2.5-coder-3b-instruct.gguf',
    quantization: 'Q4_K_M',
    contextSize: 32768,
  },
  {
    name: 'DeepSeek-Coder-V2-Lite-Instruct',
    filename: 'deepseek-coder-v2-lite-instruct.Q4_K_M.gguf',
    url: 'https://huggingface.co/DeepSeek-AI/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    contextSize: 32768,
  },
];

/** Ensure the models directory exists. */
export async function ensureModelsDir(): Promise<string> {
  await fs.ensureDir(MODELS_DIR);
  return MODELS_DIR;
}

/** Read the download status file. */
async function readStatus(): Promise<DownloadStatus> {
  try {
    if (await fs.pathExists(STATUS_FILE)) {
      return await fs.readJson(STATUS_FILE);
    }
  } catch { /* ignore */ }
  return { models: {} };
}

/** Write the download status file. */
async function writeStatus(status: DownloadStatus): Promise<void> {
  await fs.ensureDir(MODELS_DIR);
  await fs.writeJson(STATUS_FILE, status, { spaces: 2 });
}

/** Get path to a model file. */
export function getModelPath(filename: string): string {
  return path.join(MODELS_DIR, filename);
}

/** Check if a model is downloaded. */
export async function isModelDownloaded(filename: string): Promise<boolean> {
  return fs.pathExists(getModelPath(filename));
}

/** Get all available models (built-in + user-added) with their status. */
export async function listLocalModels(): Promise<ModelInfo[]> {
  await ensureModelsDir();
  const status = await readStatus();
  const results: ModelInfo[] = [];

  // Check built-in models
  for (const model of BUILTIN_MODELS) {
    const filePath = getModelPath(model.filename);
    let size = 0;
    let downloaded = false;
    try {
      const stat = await fs.stat(filePath);
      size = stat.size;
      downloaded = true;
    } catch { /* not downloaded */ }

    results.push({
      name: model.name,
      filename: model.filename,
      size,
      quantization: model.quantization,
      downloaded,
      downloadedAt: status.models[model.filename]?.timestamp,
    });
  }

  // Scan for any .gguf files not in built-in list
  const files = await fs.readdir(MODELS_DIR);
  for (const file of files) {
    if (file.endsWith('.gguf') && !BUILTIN_MODELS.some((m) => m.filename === file)) {
      const filePath = path.join(MODELS_DIR, file);
      try {
        const stat = await fs.stat(filePath);
        results.push({
          name: path.basename(file, '.gguf'),
          filename: file,
          size: stat.size,
          downloaded: true,
        });
      } catch { /* skip */ }
    }
  }

  return results;
}

/** Download a model file with progress reporting. */
export async function downloadModel(
  model: (typeof BUILTIN_MODELS)[number],
  onProgress?: (percent: number) => void,
): Promise<string> {
  const targetPath = getModelPath(model.filename);

  if (await fs.pathExists(targetPath)) {
    logger.info(`✅ ${model.name} already downloaded.`);
    return targetPath;
  }

  await ensureModelsDir();
  logger.info(`⬇️  Downloading ${model.name}...`);

  return new Promise((resolve, reject) => {
    // Use curl for download with progress
    const args = [
      '-L',
      '--progress-bar',
      '-o', targetPath,
      model.url,
    ];

    const proc = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr?.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      // Parse progress from curl stderr
      const progressMatch = str.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch && onProgress) {
        onProgress(parseFloat(progressMatch[1]));
      }
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        const stat = await fs.stat(targetPath);
        // Update status
        const status = await readStatus();
        status.models[model.filename] = {
          downloaded: true,
          timestamp: new Date().toISOString(),
          size: stat.size,
        };
        await writeStatus(status);
        logger.info(`✅ ${model.name} downloaded (${formatSize(stat.size)}).`);
        await notify(`${model.name} download completed`);
        resolve(targetPath);
      } else {
        // Clean up partial download
        try { await fs.remove(targetPath); } catch { /* ignore */ }
        reject(new Error(`Download failed (exit code ${code}): ${stderr.slice(0, 200)}`));
      }
    });

    proc.on('error', async (err) => {
      try { await fs.remove(targetPath); } catch { /* ignore */ }
      reject(err);
    });
  });
}

/** Download all built-in models (for initial setup). */
export async function downloadBuiltinModels(): Promise<void> {
  for (const model of BUILTIN_MODELS) {
    if (!(await isModelDownloaded(model.filename))) {
      try {
        await downloadModel(model);
      } catch (e: any) {
        logger.error(`Failed to download ${model.name}: ${e.message}`);
      }
    }
  }
}

/** Format bytes to human-readable size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Legacy compatibility: download Qwen model. */
export async function downloadQwenModel(): Promise<void> {
  const qwen = BUILTIN_MODELS[0];
  if (await isModelDownloaded(qwen.filename)) {
    logger.info('✅ Qwen model already present in cache.');
    return;
  }
  await downloadModel(qwen);
}
