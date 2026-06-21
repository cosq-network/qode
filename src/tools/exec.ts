import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { loadIgnoreFilter } from './ignore.js';

let cwd = process.cwd(); // can be updated

export function setCwd(newCwd: string) { cwd = newCwd; }

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function executeToolCall(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'shell_exec': {
      const cmd = args.command as string;
      const timeout = Math.max(1000, Math.min(Number(args.timeout) || 30000, 120000));
      return new Promise((resolve) => {
        exec(
          cmd,
          {
            cwd: args.cwd ? path.resolve(cwd, args.cwd) : cwd,
            maxBuffer: 10 * 1024 * 1024,
            timeout,
          },
          (err, stdout, stderr) => {
            if (err) resolve(`Error: ${err.message}\n${stderr}`);
            else resolve(stdout || stderr || 'Command completed successfully.');
          }
        );
      });
    }

    case 'file_read': {
      const requestedPath = String(args.path || '');
      const filePath = path.resolve(cwd, requestedPath);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (!isWithinRoot(filePath, cwd) || ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path is outside the current workspace or ignored.`;
      }
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    case 'file_write': {
      const requestedPath = String(args.path || '');
      const filePath = path.resolve(cwd, requestedPath);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (!isWithinRoot(filePath, cwd) || ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path is outside the current workspace or ignored.`;
      }
      try {
        await fs.outputFile(filePath, String(args.content ?? ''), 'utf8');
        return `File written: ${filePath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    case 'file_edit': {
      const requestedPath = String(args.path || '');
      const filePath = path.resolve(cwd, requestedPath);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (!isWithinRoot(filePath, cwd) || ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path is outside the current workspace or ignored.`;
      }
      try {
        let content = await fs.readFile(filePath, 'utf8');
        if (!content.includes(String(args.old_string || ''))) {
          return `Error: old_string not found.`;
        }
        content = content.replace(String(args.old_string || ''), String(args.new_string || ''));
        await fs.writeFile(filePath, content, 'utf8');
        return `File edited: ${filePath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}