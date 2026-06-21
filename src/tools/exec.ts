import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { loadIgnoreFilter } from './ignore.js';

let cwd = process.cwd();

export function setCwd(newCwd: string) {
  cwd = newCwd;
}

/**
 * Execute a built‑in tool call by name.
 * Returns a string with the result or an error message.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, any>
): Promise<string> {
  switch (name) {
    // -----------------------------------------------------------------------
    // SHELL EXECUTION
    // -----------------------------------------------------------------------
    case 'shell_exec': {
      const cmd = args.command as string;
      if (!cmd) return 'Error: no command provided.';
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: args.cwd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Error: ${err.message}\n${stderr}`);
            else resolve(stdout || stderr || '(no output)');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // FILE READING
    // -----------------------------------------------------------------------
    case 'file_read': {
      const filePath = path.resolve(args.path);
      try {
        const ignoreFilter = await loadIgnoreFilter(cwd);
        if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
          return `Error: File "${filePath}" is ignored by ignore rules.`;
        }
        const content = await fs.readFile(filePath, 'utf8');
        return content;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // FILE WRITING (overwrite)
    // -----------------------------------------------------------------------
    case 'file_write': {
      const filePath = path.resolve(args.path);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path "${filePath}" is ignored.`;
      }
      try {
        await fs.outputFile(filePath, args.content, 'utf8');
        return `File written: ${filePath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // FILE EDIT (replace first occurrence of a string)
    // -----------------------------------------------------------------------
    case 'file_edit': {
      const filePath = path.resolve(args.path);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path "${filePath}" is ignored.`;
      }
      try {
        let content = await fs.readFile(filePath, 'utf8');
        if (!content.includes(args.old_string)) {
          return `Error: old_string not found in file.`;
        }
        content = content.replace(args.old_string, args.new_string);
        await fs.writeFile(filePath, content, 'utf8');
        return `File edited: ${filePath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // FIND FILES (by name pattern, respecting ignore rules)
    // -----------------------------------------------------------------------
    case 'file_find': {
      const pattern = args.pattern as string;
      const searchDir = path.resolve(args.directory || cwd);
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
        return results.length ? results.join('\n') : 'No files found.';
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // GREP (search content inside files, respecting ignore rules)
    // -----------------------------------------------------------------------
    case 'grep': {
      const pattern = args.pattern as string;
      const searchDir = path.resolve(args.directory || cwd);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      const results: string[] = [];
      try {
        const walk = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(cwd, fullPath);
            if (ignoreFilter.ignores(relPath)) continue;
            if (entry.isDirectory()) {
              await walk(fullPath);
            } else if (entry.isFile()) {
              try {
                const content = await fs.readFile(fullPath, 'utf8');
                if (content.includes(pattern)) {
                  const lines = content
                    .split('\n')
                    .filter((line) => line.includes(pattern))
                    .map((line) => `${relPath}: ${line.trim()}`);
                  results.push(...lines);
                }
              } catch {
                // skip unreadable files
              }
            }
          }
        };
        await walk(searchDir);
        return results.length ? results.join('\n') : 'No matches found.';
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // RUN LINTER
    // -----------------------------------------------------------------------
    case 'run_linter': {
      const { filePath, linter, cwd: wd } = args;
      if (!filePath || !linter) return 'Error: filePath and linter required.';
      const cmd = `${linter} ${filePath}`;
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Linter error:\n${stderr || err.message}`);
            else resolve(stdout || stderr || 'Linter completed with no output.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // RUN TESTS
    // -----------------------------------------------------------------------
    case 'run_tests': {
      const { testCommand, cwd: wd } = args;
      if (!testCommand) return 'Error: testCommand required.';
      return new Promise((resolve) => {
        exec(
          testCommand,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err)
              resolve(
                `Tests failed:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
              );
            else resolve(stdout || 'All tests passed.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // CODE REVIEW (stub – the assistant handles the review after reading code)
    // -----------------------------------------------------------------------
    case 'code_review': {
      // This tool simply signals that a review is requested; the agent will follow up.
      return 'Code review requested. The assistant will now perform the review.';
    }

    // -----------------------------------------------------------------------
    // RUN CODE FORMATTER
    // -----------------------------------------------------------------------
    case 'run_formatter': {
      const { filePath, formatter, cwd: wd } = args;
      if (!filePath || !formatter) return 'Error: filePath and formatter required.';
      const cmd = `${formatter} ${filePath}`;
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Formatter error:\n${stderr || err.message}`);
            else resolve(stdout || 'File formatted successfully.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // INSTALL PACKAGE (npm, pip, etc.)
    // -----------------------------------------------------------------------
    case 'install_package': {
      const { manager, packages, cwd: wd } = args;
      if (!manager || !packages) return 'Error: manager (e.g., npm, pip) and packages required.';
      const pkgList = Array.isArray(packages) ? packages.join(' ') : packages;
      const cmd = `${manager} install ${pkgList}`;
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Installation failed:\n${stderr || err.message}`);
            else resolve(stdout || 'Package(s) installed.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // GIT COMMAND
    // -----------------------------------------------------------------------
    case 'git_command': {
      const { gitArgs, cwd: wd } = args;
      if (!gitArgs) return 'Error: gitArgs required (e.g., "status", "log --oneline").';
      const cmd = `git ${gitArgs}`;
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Git error:\n${stderr || err.message}`);
            else resolve(stdout || 'Done.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // CREATE DIRECTORY
    // -----------------------------------------------------------------------
    case 'create_directory': {
      const dirPath = path.resolve(args.path);
      try {
        await fs.ensureDir(dirPath);
        return `Directory created: ${dirPath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // DELETE FILE OR DIRECTORY
    // -----------------------------------------------------------------------
    case 'delete_file_or_dir': {
      const targetPath = path.resolve(args.path);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, targetPath))) {
        return `Error: Path "${targetPath}" is ignored.`;
      }
      try {
        await fs.remove(targetPath);
        return `Deleted: ${targetPath}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // DEFAULT
    // -----------------------------------------------------------------------
    default:
      return `Unknown tool: ${name}`;
  }
}