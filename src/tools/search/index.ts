import fs from 'fs-extra';
import path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { getCwd } from '../helpers.js';
import { loadIgnoreFilter } from '../ignore.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const execFileAsync = promisify(execFileCb);

let rgAvailable: boolean | null = null;
async function hasRg(): Promise<boolean> {
  if (rgAvailable !== null) return rgAvailable;
  try {
    await execFileAsync('rg', ['--version']);
    rgAvailable = true;
  } catch {
    rgAvailable = false;
  }
  return rgAvailable;
}

function matchGlob(filename: string, pattern: string): boolean {
  const braceMatch = pattern.match(/^(.*)\{(.+)\}(.*)$/);
  if (braceMatch) {
    const [, prefix, choices, suffix] = braceMatch;
    const alternatives = choices!.split(',').map((s) => s.trim());
    return alternatives.some((alt) => matchGlob(filename, `${prefix}${alt}${suffix}`));
  }
  const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr).test(filename);
}

function matchFullGlob(relPath: string, pattern: string): boolean {
  const normalizedPath = relPath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  if (normalizedPattern.includes('**')) {
    const parts = normalizedPattern.split('**').map((s) => s.replace(/^\/|\/$/g, ''));
    const startsWithStar = normalizedPattern.startsWith('**');
    const suffix = parts[parts.length - 1] || '';
    const prefix = parts[0] || '';
    if (suffix && !matchGlob(filename(normalizedPath), suffix)) return false;
    if (!startsWithStar && prefix && !normalizedPath.startsWith(prefix.replace(/^\//, ''))) return false;
    return true;
  }
  return matchGlob(normalizedPath, normalizedPattern) || matchGlob(filename(normalizedPath), normalizedPattern);
}

function filename(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

// ── Enhanced grep ──────────────────────────────────────────────────

const grep: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search file contents using regex patterns. Uses ripgrep when available for speed. Returns structured matches with file, line number, and context.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          directory: { type: 'string', description: 'Directory to search (default: cwd)' },
          include: { type: 'string', description: 'Glob for files to include, e.g. "*.ts"' },
          exclude: { type: 'string', description: 'Glob for files to exclude' },
          caseInsensitive: { type: 'boolean', description: 'Case-insensitive search' },
          contextLines: { type: 'number', description: 'Context lines before/after match' },
          maxResults: { type: 'number', description: 'Max matches to return (default 200)' },
        },
        required: ['pattern'],
      },
    },
  } as any,
  metadata: { category: 'search', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = getCwd();
    const pattern = args.pattern as string;
    const searchDir = path.resolve((args.directory as string) || cwd);
    const maxResults = (args.maxResults as number) || 200;
    const contextLines = (args.contextLines as number) || 0;

    if (await hasRg()) {
      const rgArgs: string[] = ['--no-heading', '--line-number', '--color=never', '--max-count', String(maxResults)];
      if (args.caseInsensitive) rgArgs.push('-i');
      if (contextLines > 0) rgArgs.push('-C', String(contextLines));
      if (args.include) rgArgs.push('-g', args.include as string);
      if (args.exclude) rgArgs.push('!', '-g', args.exclude as string);
      rgArgs.push(pattern, searchDir);
      try {
        const { stdout } = await execFileAsync('rg', rgArgs, { maxBuffer: 10 * 1024 * 1024 });
        const results = stdout.trim().split('\n').filter(Boolean).map((line) => {
          const match = line.match(/^(.+?):(\d+)(?::(\d+))?: (.*)$/);
          if (match) {
            const [, file, lineNum, col, content] = match;
            return `${path.relative(cwd, file!)}:${lineNum}${col ? ':' + col : ''} ${content}`;
          }
          return line;
        });
        return { output: results.length ? results.join('\n') : 'No matches found.' };
      } catch (e: any) {
        if (e.exitCode === 1) return { output: 'No matches found.' };
        return { output: '', error: e.message };
      }
    }

    // Node.js fallback
    const ignoreFilter = await loadIgnoreFilter(cwd);
    const flags = args.caseInsensitive ? 'i' : '';
    let regex: RegExp;
    try { regex = new RegExp(pattern, flags); } catch (e: any) { return { output: '', error: `Invalid regex: ${e.message}` }; }
    const results: string[] = [];
    const includeGlob = args.include as string | undefined;
    const walk = async (dir: string) => {
      if (results.length >= maxResults) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(cwd, fullPath);
        if (ignoreFilter.ignores(relPath)) continue;
        if (entry.isDirectory()) { await walk(fullPath); }
        else if (entry.isFile()) {
          if (includeGlob && !matchGlob(entry.name, includeGlob)) continue;
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return;
              if (regex.test(lines[i])) results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
            }
          } catch { /* skip */ }
        }
      }
    };
    try { await walk(searchDir); return { output: results.length ? results.join('\n') : 'No matches found.' }; }
    catch (e: unknown) { return { output: '', error: e instanceof Error ? e.message : String(e) }; }
  },
};

// ── Glob tool ──────────────────────────────────────────────────────

const globTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern. Returns paths sorted by modification time (most recent first).',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern, e.g. "**/*.ts"' },
          path: { type: 'string', description: 'Directory to search (default: cwd)' },
          maxDepth: { type: 'number', description: 'Max directory depth' },
          maxResults: { type: 'number', description: 'Max results (default 200)' },
        },
        required: ['pattern'],
      },
    },
  } as any,
  metadata: { category: 'search', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = getCwd();
    const pattern = args.pattern as string;
    const searchDir = path.resolve((args.path as string) || cwd);
    const maxResults = (args.maxResults as number) || 200;
    const maxDepth = args.maxDepth as number | undefined;
    const ignoreFilter = await loadIgnoreFilter(cwd);
    const results: Array<{ file: string; mtime: number }> = [];
    const walk = async (dir: string, depth: number) => {
      if (maxDepth !== undefined && depth > maxDepth) return;
      if (results.length >= maxResults) return;
      let entries: fs.Dirent[];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(cwd, fullPath);
        if (ignoreFilter.ignores(relPath)) continue;
        if (entry.isDirectory()) { await walk(fullPath, depth + 1); }
        else if (entry.isFile() && matchFullGlob(relPath, pattern)) {
          try { const stat = await fs.stat(fullPath); results.push({ file: relPath, mtime: stat.mtimeMs }); }
          catch { results.push({ file: relPath, mtime: 0 }); }
        }
      }
    };
    try {
      await walk(searchDir, 0);
      results.sort((a, b) => b.mtime - a.mtime);
      return { output: results.map((r) => r.file).join('\n') || 'No matching files found.' };
    } catch (e: unknown) { return { output: '', error: e instanceof Error ? e.message : String(e) }; }
  },
};

// ── grep_regex (alias) ────────────────────────────────────────────

const grepRegex: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'grep_regex',
      description: 'Search for regex matches inside files. (Alias for grep)',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern' },
          directory: { type: 'string', description: 'Directory to search' },
          fileExtensions: { type: 'array', items: { type: 'string' }, description: 'Extensions to include' },
          caseInsensitive: { type: 'boolean', description: 'Case-insensitive' },
        },
        required: ['pattern'],
      },
    },
  } as any,
  metadata: { category: 'search', permissionKey: 'read' },
  execute: async (args) => {
    const exts = args.fileExtensions as string[] | undefined;
    const include = exts?.length ? exts.map((e) => `*.${e}`).join(',') : undefined;
    return grep.execute({ ...args, include });
  },
};

// ── grep_find_and_replace ──────────────────────────────────────────

const grepFindAndReplace: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'grep_find_and_replace',
      description: 'Find and replace a string or regex across multiple files.',
      parameters: {
        type: 'object',
        properties: {
          findPattern: { type: 'string', description: 'Pattern to find' },
          replacement: { type: 'string', description: 'Replacement text' },
          directory: { type: 'string', description: 'Directory to search' },
          isRegex: { type: 'boolean', description: 'Treat as regex' },
          fileExtensions: { type: 'array', items: { type: 'string' }, description: 'Extensions to include' },
        },
        required: ['findPattern', 'replacement'],
      },
    },
  } as any,
  metadata: { category: 'search', permissionKey: 'edit' },
  execute: async (args) => {
    const cwd = getCwd();
    const findPattern = args.findPattern as string;
    const replacement = args.replacement as string;
    if (findPattern === undefined || replacement === undefined) return { output: '', error: 'findPattern and replacement are required.' };
    const searchDir = path.resolve((args.directory as string) || cwd);
    const ignoreFilter = await loadIgnoreFilter(cwd);
    const extensions = (args.fileExtensions as string[]) || [];
    let modifiedFilesCount = 0;
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const findRule = args.isRegex ? new RegExp(findPattern, 'g') : new RegExp(escapeRegExp(findPattern), 'g');
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(cwd, fullPath);
        if (ignoreFilter.ignores(relPath)) continue;
        if (entry.isDirectory()) { await walk(fullPath); }
        else if (entry.isFile()) {
          if (extensions.length > 0 && !extensions.includes(path.extname(entry.name).slice(1))) continue;
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            if (findRule.test(content)) { findRule.lastIndex = 0; await fs.writeFile(fullPath, content.replace(findRule, replacement), 'utf8'); modifiedFilesCount++; }
          } catch { /* skip */ }
        }
      }
    };
    try { await walk(searchDir); return { output: `Successfully modified ${modifiedFilesCount} file(s).` }; }
    catch (e: unknown) { return { output: '', error: e instanceof Error ? e.message : String(e) }; }
  },
};

// ── file_find_by_metadata ──────────────────────────────────────────

const fileFindByMetadata: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'file_find_by_metadata',
      description: 'Find files by metadata: type, size, or modification time.',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to search' },
          type: { type: 'string', enum: ['file', 'directory'], description: 'Filter by type' },
          minSize: { type: 'string', description: 'Min size, e.g. "10kb"' },
          maxSize: { type: 'string', description: 'Max size, e.g. "2mb"' },
          modifiedWithin: { type: 'string', description: 'Modified within, e.g. "24h"' },
        },
      },
    },
  } as any,
  metadata: { category: 'search', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = getCwd();
    const { directory, type: filterType, minSize, maxSize, modifiedWithin } = args;
    const searchDir = path.resolve((directory as string) || cwd);
    const ignoreFilter = await loadIgnoreFilter(cwd);
    const results: string[] = [];
    const parseSize = (s: string): number => { const m = s.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/); if (!m) return 0; const v = parseFloat(m[1]); if (m[2] === 'kb') return v * 1024; if (m[2] === 'mb') return v * 1048576; if (m[2] === 'gb') return v * 1073741824; return v; };
    const parseDuration = (s: string): number => { const m = s.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/); if (!m) return 0; const v = parseFloat(m[1]); if (m[2] === 'm') return v * 60000; if (m[2] === 'h') return v * 3600000; if (m[2] === 'd') return v * 86400000; return 0; };
    const minBytes = minSize ? parseSize(minSize as string) : 0;
    const maxBytes = maxSize ? parseSize(maxSize as string) : Infinity;
    const modMs = modifiedWithin ? parseDuration(modifiedWithin as string) : Infinity;
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(cwd, fullPath);
        if (ignoreFilter.ignores(relPath)) continue;
        if (filterType === 'file' && !entry.isFile()) continue;
        if (filterType === 'directory' && !entry.isDirectory()) continue;
        try {
          const stat = await fs.stat(fullPath);
          if (entry.isFile() && (stat.size < minBytes || stat.size > maxBytes)) continue;
          if (modMs !== Infinity && Date.now() - stat.mtimeMs > modMs) continue;
          results.push(relPath);
        } catch { /* skip */ }
        if (entry.isDirectory()) await walk(fullPath);
      }
    };
    try { await walk(searchDir); return { output: results.length ? results.join('\n') : 'No matching files found.' }; }
    catch (e: unknown) { return { output: '', error: e instanceof Error ? e.message : String(e) }; }
  },
};

export function registerSearchTools(): void {
  globalRegistry.register(grep);
  globalRegistry.register(globTool);
  globalRegistry.register(grepRegex);
  globalRegistry.register(grepFindAndReplace);
  globalRegistry.register(fileFindByMetadata);
}
