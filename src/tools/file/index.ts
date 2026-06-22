import fs from 'fs-extra';
import path from 'path';
import { getCwd } from '../helpers.js';
import { loadIgnoreFilter } from '../ignore.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const fileRead: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read a file, respecting .gitignore/.dockerignore.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path' },
        },
        required: ['path'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = getCwd();
    const filePath = path.resolve(args.path as string);
    try {
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return { output: '', error: `File "${filePath}" is ignored by ignore rules.` };
      }
      const content = await fs.readFile(filePath, 'utf8');
      return { output: content };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

const fileWrite: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write or overwrite a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'edit' },
  execute: async (args) => {
    const cwd = getCwd();
    const filePath = path.resolve(args.path as string);
    const ignoreFilter = await loadIgnoreFilter(cwd);
    if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
      return { output: '', error: `Path "${filePath}" is ignored.` };
    }
    try {
      await fs.outputFile(filePath, args.content as string, 'utf8');
      return { output: `File written: ${filePath}` };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

const fileEdit: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing the first occurrence of old_string with new_string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'edit' },
  execute: async (args) => {
    const cwd = getCwd();
    const filePath = path.resolve(args.path as string);
    const ignoreFilter = await loadIgnoreFilter(cwd);
    if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
      return { output: '', error: `Path "${filePath}" is ignored.` };
    }
    try {
      let content = await fs.readFile(filePath, 'utf8');
      if (!content.includes(args.old_string as string)) {
        return { output: '', error: 'old_string not found in file.' };
      }
      content = content.replace(args.old_string as string, args.new_string as string);
      await fs.writeFile(filePath, content, 'utf8');
      return { output: `File edited: ${filePath}` };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

const fileFind: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'file_find',
      description:
        'Find files by a substring in their filename, recursively from a directory (default: current). Respects ignore rules.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Substring to match in file names',
          },
          directory: {
            type: 'string',
            description: 'Directory to search (default: cwd)',
          },
        },
        required: ['pattern'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = getCwd();
    const pattern = args.pattern as string;
    const searchDir = path.resolve((args.directory as string) || cwd);
    try {
      const ignoreFilter = await loadIgnoreFilter(cwd);
      const results: string[] = [];
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(cwd, fullPath);
          if (ignoreFilter.ignores(relPath)) continue;
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.includes(pattern)) {
            results.push(relPath);
          }
        }
      };
      await walk(searchDir);
      return {
        output: results.length ? results.join('\n') : 'No files found.',
      };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

const createDirectory: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'create_directory',
      description: 'Create a new directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
        },
        required: ['path'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'edit' },
  execute: async (args) => {
    if (!args.path) return { output: '', error: 'path required for create_directory' };
    const dirPath = path.resolve(args.path as string);
    try {
      await fs.ensureDir(dirPath);
      return { output: `Directory created: ${dirPath}` };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

const deleteFileOrDir: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'delete_file_or_dir',
      description: 'Delete a file or directory (respects ignore rules).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete' },
        },
        required: ['path'],
      },
    },
  },
  metadata: { category: 'file', permissionKey: 'edit', requiresConfirmation: true },
  execute: async (args) => {
    const cwd = getCwd();
    if (!args.path) return { output: '', error: 'path required for delete_file_or_dir' };
    const targetPath = path.resolve(args.path as string);
    const ignoreFilter = await loadIgnoreFilter(cwd as string);
    if (ignoreFilter.ignores(path.relative(cwd, targetPath))) {
      return { output: '', error: `Path "${targetPath}" is ignored.` };
    }
    try {
      await fs.remove(targetPath);
      return { output: `Deleted: ${targetPath}` };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { output: '', error: errMsg };
    }
  },
};

// ────────────────────────────────────────────────────────────────────
// apply_patch — unified diff applier
// ────────────────────────────────────────────────────────────────────

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: Array<{ type: 'context' | 'add' | 'remove'; content: string }>;
}

interface ParsedPatch {
  oldFile: string;
  newFile: string;
  hunks: DiffHunk[];
  isDelete: boolean;
  isNew: boolean;
}

/** Parse a unified diff patch string into structured data. */
function parsePatch(patchText: string): ParsedPatch[] {
  const patches: ParsedPatch[] = [];
  const files = patchText.split(/^diff --git /m).filter(Boolean);

  for (const fileBlock of files) {
    const lines = fileBlock.split('\n');
    let oldFile = '';
    let newFile = '';
    let isDelete = false;
    let isNew = false;
    const hunks: DiffHunk[] = [];

    // Parse file headers
    for (const line of lines) {
      const oldMatch = line.match(/^--- (.+)/);
      const newMatch = line.match(/^\+\+\+ (.+)/);
      if (oldMatch) {
        oldFile = oldMatch[1].replace(/^a\//, '').replace(/^b\//, '');
        if (oldFile === '/dev/null') { isNew = true; oldFile = ''; }
      }
      if (newMatch) {
        newFile = newMatch[1].replace(/^a\//, '').replace(/^b\//, '');
        if (newFile === '/dev/null') { isDelete = true; newFile = ''; }
      }
    }

    // Parse hunks
    let currentHunk: DiffHunk | null = null;
    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldLines: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2]) : 1,
          newStart: parseInt(hunkMatch[3]),
          newLines: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4]) : 1,
          changes: [],
        };
        continue;
      }
      if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.changes.push({ type: 'add', content: line.slice(1) });
        } else if (line.startsWith('-')) {
          currentHunk.changes.push({ type: 'remove', content: line.slice(1) });
        } else if (line.startsWith(' ')) {
          currentHunk.changes.push({ type: 'context', content: line.slice(1) });
        }
      }
    }
    if (currentHunk) hunks.push(currentHunk);

    patches.push({ oldFile, newFile, hunks, isDelete, isNew });
  }

  return patches;
}

/** Apply a single parsed patch to a file. Returns the new content or null on error. */
function applyPatchToContent(
  originalLines: string[],
  patch: ParsedPatch,
): { lines: string[]; error?: string } {
  if (patch.isDelete) {
    return { lines: [] };
  }
  if (patch.isNew) {
    // New file — all hunk lines are additions
    const newLines: string[] = [];
    for (const hunk of patch.hunks) {
      for (const change of hunk.changes) {
        if (change.type === 'add') newLines.push(change.content);
      }
    }
    return { lines: newLines };
  }

  // Apply hunks in reverse order to keep line numbers stable
  const result = [...originalLines];
  for (let i = patch.hunks.length - 1; i >= 0; i--) {
    const hunk = patch.hunks[i];
    // Find where in the original file this hunk applies
    let searchStart = hunk.oldStart - 1; // 0-indexed
    if (searchStart < 0) searchStart = 0;

    // Build the expected old lines from the hunk
    const expectedOld: string[] = [];
    const newLines: string[] = [];
    for (const change of hunk.changes) {
      if (change.type === 'context' || change.type === 'remove') {
        expectedOld.push(change.content);
      }
      if (change.type === 'context' || change.type === 'add') {
        newLines.push(change.content);
      }
    }

    // Search for the matching region
    let foundAt = -1;
    for (let pos = Math.max(0, searchStart - 5); pos <= Math.min(result.length - expectedOld.length, searchStart + 5); pos++) {
      let match = true;
      for (let j = 0; j < expectedOld.length; j++) {
        if ((result[pos + j] ?? '') !== expectedOld[j]) {
          match = false;
          break;
        }
      }
      if (match) { foundAt = pos; break; }
    }

    if (foundAt === -1) {
      // Try exact match from oldStart
      let match = true;
      for (let j = 0; j < expectedOld.length; j++) {
        if ((result[searchStart + j] ?? '') !== expectedOld[j]) {
          match = false;
          break;
        }
      }
      if (match) foundAt = searchStart;
    }

    if (foundAt === -1) {
      return { lines: originalLines, error: `Hunk at line ${hunk.oldStart} does not match` };
    }

    result.splice(foundAt, expectedOld.length, ...newLines);
  }

  return { lines: result };
}

const applyPatch: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Apply a unified diff patch to one or more files. Supports creating, updating, and deleting files.',
      parameters: {
        type: 'object',
        properties: {
          patch: { type: 'string', description: 'The unified diff patch text' },
          cwd: { type: 'string', description: 'Working directory (default: cwd)' },
        },
        required: ['patch'],
      },
    },
  } as any,
  metadata: { category: 'file', permissionKey: 'edit', requiresConfirmation: true },
  execute: async (args) => {
    const cwd = getCwd();
    const patchText = args.patch as string;
    if (!patchText) return { output: '', error: 'patch is required' };

    const patches = parsePatch(patchText);
    if (patches.length === 0) return { output: '', error: 'No valid patches found in input' };

    const results: string[] = [];

    for (const patch of patches) {
      const targetFile = patch.newFile || patch.oldFile;
      if (!targetFile) {
        results.push('SKIP: No target file specified in patch');
        continue;
      }

      const filePath = path.resolve(cwd, targetFile);

      try {
        if (patch.isNew) {
          // Create new file
          const { lines, error } = applyPatchToContent([], patch);
          if (error) { results.push(`ERROR ${targetFile}: ${error}`); continue; }
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf8');
          results.push(`CREATE ${targetFile}`);
        } else if (patch.isDelete) {
          // Delete file
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            results.push(`DELETE ${targetFile}`);
          } else {
            results.push(`SKIP ${targetFile}: file not found`);
          }
        } else {
          // Update existing file
          if (!await fs.pathExists(filePath)) {
            results.push(`ERROR ${targetFile}: file not found`);
            continue;
          }
          const original = await fs.readFile(filePath, 'utf8');
          const originalLines = original.split('\n');
          const { lines, error } = applyPatchToContent(originalLines, patch);
          if (error) { results.push(`ERROR ${targetFile}: ${error}`); continue; }
          await fs.writeFile(filePath, lines.join('\n'), 'utf8');
          results.push(`UPDATE ${targetFile}`);
        }
      } catch (e: unknown) {
        results.push(`ERROR ${targetFile}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { output: results.join('\n') };
  },
};

/** Register all file tools. */
export function registerFileTools(): void {
  globalRegistry.register(fileRead);
  globalRegistry.register(fileWrite);
  globalRegistry.register(fileEdit);
  globalRegistry.register(fileFind);
  globalRegistry.register(createDirectory);
  globalRegistry.register(deleteFileOrDir);
  globalRegistry.register(applyPatch);
}
