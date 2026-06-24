import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { notify } from '../utils/notification.js';
import { getQodeSubdir, getWritableQodeSubdir } from '../utils/app-paths.js';
import { setDownloadProgress, loadDownloadProgress } from '../utils/download-progress.js';

function getModelsDir(): string {
  return getQodeSubdir('models');
}

function getStatusFile(): string {
  return path.join(getModelsDir(), 'status.json');
}

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
  const dir = getWritableQodeSubdir('models');
  await fs.ensureDir(dir);
  return dir;
}

/** Read the download status file. */
async function readStatus(): Promise<DownloadStatus> {
  try {
    const statusFile = getStatusFile();
    if (await fs.pathExists(statusFile)) {
      return await fs.readJson(statusFile);
    }
  } catch { /* ignore */ }
  return { models: {} };
}

/** Write the download status file. */
async function writeStatus(status: DownloadStatus): Promise<void> {
  const dir = getWritableQodeSubdir('models');
  await fs.ensureDir(dir);
  await fs.writeJson(path.join(dir, 'status.json'), status, { spaces: 2 });
}

/** Get path to a model file. */
export function getModelPath(filename: string): string {
  return path.join(getModelsDir(), filename);
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
  const files = await fs.readdir(getModelsDir());
  for (const file of files) {
    if (file.endsWith('.gguf') && !BUILTIN_MODELS.some((m) => m.filename === file)) {
      const filePath = path.join(getModelsDir(), file);
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
  options?: { onProgress?: (percent: number) => void; silent?: boolean },
): Promise<string> {
  const targetPath = getModelPath(model.filename);
  const silent = options?.silent ?? false;
  const onProgress = options?.onProgress;

  if (await fs.pathExists(targetPath)) {
    if (!silent) logger.info(`✅ ${model.name} already downloaded.`);
    setDownloadProgress(model.filename, { modelName: model.name, filename: model.filename, status: 'completed', percent: 100 });
    return targetPath;
  }

  await ensureModelsDir();
  if (!silent) logger.info(`⬇️  Downloading ${model.name}...`);

  setDownloadProgress(model.filename, {
    modelName: model.name,
    filename: model.filename,
    status: 'downloading',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    startedAt: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
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
      const progressMatch = str.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        const pct = parseFloat(progressMatch[1]);
        if (onProgress) onProgress(pct);
        const byteMatch = str.match(/(\d+(?:\.\d+)?[kKMGT]?)\s*\/\s*(\d+(?:\.\d+)?[kKMGT]?)/i);
        let downloadedBytes = 0;
        let totalBytes = 0;
        if (byteMatch) {
          downloadedBytes = parseSize(byteMatch[1]);
          totalBytes = parseSize(byteMatch[2]);
        }
        setDownloadProgress(model.filename, { percent: pct, downloadedBytes, totalBytes });
      }
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        const stat = await fs.stat(targetPath);
        const status = await readStatus();
        status.models[model.filename] = {
          downloaded: true,
          timestamp: new Date().toISOString(),
          size: stat.size,
        };
        await writeStatus(status);
        setDownloadProgress(model.filename, {
          status: 'completed', percent: 100, downloadedBytes: stat.size, totalBytes: stat.size,
          completedAt: new Date().toISOString(),
        });
        if (!silent) logger.info(`✅ ${model.name} downloaded (${formatSize(stat.size)}).`);
        if (!silent) await notify(`${model.name} download completed`);
        resolve(targetPath);
      } else {
        try { await fs.remove(targetPath); } catch { }
        setDownloadProgress(model.filename, { status: 'failed', error: `exit code ${code}` });
        reject(new Error(`Download failed (exit code ${code}): ${stderr.slice(0, 200)}`));
      }
    });

    proc.on('error', async (err) => {
      try { await fs.remove(targetPath); } catch { }
      setDownloadProgress(model.filename, { status: 'failed', error: err.message });
      reject(err);
    });
  });
}

function parseSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*([kKMGT]?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  return Math.round(num * (multipliers[unit] ?? 1));
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

export { loadDownloadProgress, listDownloadProgress } from '../utils/download-progress.js';
export { getDownloadProgress, setDownloadProgress } from '../utils/download-progress.js';

/** Download Qwen model silently in background with progress tracking. */
export async function downloadQwenModelSilent(): Promise<void> {
  await loadDownloadProgress();
  const qwen = BUILTIN_MODELS[0];
  if (await isModelDownloaded(qwen.filename)) {
    setDownloadProgress(qwen.filename, { modelName: qwen.name, filename: qwen.filename, status: 'completed', percent: 100 });
    return;
  }
  try {
    await downloadModel(qwen, { silent: true });
  } catch { }
}

/** Legacy compatibility: download Qwen model with logging. */
export async function downloadQwenModel(): Promise<void> {
  const qwen = BUILTIN_MODELS[0];
  if (await isModelDownloaded(qwen.filename)) {
    logger.info('✅ Qwen model already present in cache.');
    return;
  }
  await downloadModel(qwen);
}
