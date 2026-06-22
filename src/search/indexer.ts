import fs from 'fs-extra';
import path from 'path';
import { getVectorStore, type VectorDocument } from './vector-store.js';
import { getCwd } from '../tools/helpers.js';
import { loadIgnoreFilter } from '../tools/ignore.js';
import { logger } from '../utils/logger.js';

const CHUNK_SIZE = 50; // lines per chunk
const CHUNK_OVERLAP = 10; // overlapping lines between chunks

/** Index a single file into the vector store. */
export async function indexFile(filePath: string): Promise<number> {
  const store = getVectorStore();
  const cwd = getCwd();
  const ignoreFilter = await loadIgnoreFilter(cwd);

  const relativePath = path.relative(cwd, filePath);

  // Check if file should be ignored
  if (ignoreFilter.ignores(relativePath)) {
    return 0;
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Index as chunks for large files
    if (lines.length > CHUNK_SIZE) {
      const chunks = chunkLines(lines, CHUNK_SIZE, CHUNK_OVERLAP);
      let chunkIndex = 0;
      for (const chunk of chunks) {
        const chunkContent = chunk.lines.join('\n');
        const doc: VectorDocument = {
          id: `${relativePath}:${chunk.startLine}-${chunk.endLine}`,
          content: chunkContent,
          metadata: {
            filePath: relativePath,
            lineStart: chunk.startLine,
            lineEnd: chunk.endLine,
            type: 'chunk',
          },
          vector: [],
        };
        store.addDocument(doc);
        chunkIndex++;
      }
      return chunkIndex;
    } else {
      // Small file - index as single document
      const doc: VectorDocument = {
        id: relativePath,
        content,
        metadata: {
          filePath: relativePath,
          type: 'file',
        },
        vector: [],
      };
      store.addDocument(doc);
      return 1;
    }
  } catch {
    // Skip files that can't be read
    return 0;
  }
}

/** Index a directory recursively. */
export async function indexDirectory(dirPath: string, maxFiles: number = 1000): Promise<number> {
  const cwd = getCwd();
  const ignoreFilter = await loadIgnoreFilter(cwd);

  let indexed = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (indexed >= maxFiles) break;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(cwd, fullPath);

    // Skip ignored paths
    if (ignoreFilter.ignores(relativePath)) {
      continue;
    }

    // Skip common non-code directories
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
        continue;
      }
      indexed += await indexDirectory(fullPath, maxFiles - indexed);
    } else if (entry.isFile()) {
      // Only index text files
      const ext = path.extname(entry.name).toLowerCase();
      const textExtensions = [
        '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
        '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
        '.html', '.css', '.scss', '.yaml', '.yml', '.toml',
        '.sh', '.bash', '.zsh', '.fish',
      ];

      if (textExtensions.includes(ext) || ext === '') {
        const count = await indexFile(fullPath);
        indexed += count;
      }
    }
  }

  return indexed;
}

/** Chunk lines with overlap. */
function chunkLines(
  lines: string[],
  chunkSize: number,
  overlap: number,
): Array<{ lines: string[]; startLine: number; endLine: number }> {
  const chunks: Array<{ lines: string[]; startLine: number; endLine: number }> = [];

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const start = i;
    const end = Math.min(i + chunkSize, lines.length);
    chunks.push({
      lines: lines.slice(start, end),
      startLine: start + 1,
      endLine: end,
    });

    if (end === lines.length) break;
  }

  return chunks;
}

/** Build the index for the current workspace. */
export async function buildIndex(maxFiles: number = 1000): Promise<number> {
  const store = getVectorStore();
  const cwd = getCwd();

  logger.info(`Building search index for ${cwd}...`);
  store.clear();

  const indexed = await indexDirectory(cwd, maxFiles);
  store.computeIDF();

  // Save index to disk
  const indexPath = path.join(cwd, '.qode', 'search-index.json');
  await store.save(indexPath);

  logger.info(`✔ Indexed ${indexed} files/chunks`);
  return indexed;
}

/** Load existing index from disk. */
export async function loadIndex(): Promise<boolean> {
  const store = getVectorStore();
  const cwd = getCwd();
  const indexPath = path.join(cwd, '.qode', 'search-index.json');

  try {
    await store.load(indexPath);
    return store.size() > 0;
  } catch {
    return false;
  }
}

/** Search the index. */
export function searchIndex(query: string, topK: number = 10) {
  const store = getVectorStore();
  return store.search(query, topK);
}
