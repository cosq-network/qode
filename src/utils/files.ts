// src/utils/files.ts
import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';

export async function getRecentFiles(cwd: string, limit = 5): Promise<string[]> {
  const ignoreFilter = ignore();
  // Always ignore common binaries, libraries, and vcs folders
  ignoreFilter.add(['.git', 'node_modules', 'dist', '.agents', '.qode', 'package-lock.json', '.DS_Store']);

  // Load custom gitignore if exists
  const gitignorePath = path.join(cwd, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      ignoreFilter.add(gitignoreContent);
    } catch {
      // ignore read error
    }
  }

  const allFiles: { path: string; mtimeMs: number }[] = [];

  async function walk(dir: string) {
    let items;
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(cwd, fullPath);

      if (ignoreFilter.ignores(relativePath)) {
        continue;
      }

      if (item.isDirectory()) {
        await walk(fullPath);
      } else if (item.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          allFiles.push({ path: relativePath, mtimeMs: stat.mtimeMs });
        } catch {
          // ignore stat error
        }
      }
    }
  }

  await walk(cwd);

  // Sort files descending by modification time
  allFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return allFiles.slice(0, limit).map(f => f.path);
}
