import { exec, execFile } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { loadIgnoreFilter } from './ignore.js';

let cwd = process.cwd();

export function setCwd(newCwd: string) {
  cwd = newCwd;
}

/** Check if a command contains dangerous patterns that should be blocked. */
function containsDangerousPatterns(cmd: string): string | null {
  const dangerousPatterns: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /\brm\s+-rf\b/, description: 'rm -rf' },
    { pattern: /\bmkfs\b/, description: 'mkfs' },
    { pattern: /\bdd\s+if=/, description: 'dd if=' },
    { pattern: /\bchmod\s+-R\s+777\b/, description: 'chmod -R 777' },
    { pattern: /\bchown\s+-R\b/, description: 'chown -R' },
    { pattern: /\bcurl\b.*\|\s*sh\b/, description: 'curl | sh' },
    { pattern: /\bwget\b.*\|\s*sh\b/, description: 'wget | sh' },
    { pattern: /\bpython\b.*-c.*os\.system/, description: 'python os.system' },
    { pattern: /\bnode\b.*-e.*child_process/, description: 'node child_process' },
    { pattern: /\beval\s*\(/, description: 'eval()' },
    { pattern: /\bexec\s*\(/, description: 'exec()' },
  ];
  for (const { pattern, description } of dangerousPatterns) {
    if (pattern.test(cmd)) {
      return description;
    }
  }
  return null;
}

function runGit(gitArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'git',
      gitArgs,
      { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`Git error: ${stderr || err.message}`);
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

function runNpm(npmArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'npm',
      npmArgs,
      { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(stdout || stderr || `NPM error: ${err.message}`);
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

function runCmake(cmakeArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'cmake',
      cmakeArgs,
      { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`CMake error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

function runCtest(ctestArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'ctest',
      ctestArgs,
      { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`CTest error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

function runExecutable(binary: string, binaryArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      binary,
      binaryArgs,
      { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`${binary} error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

const getVenvBinary = (venvDir: string, binaryName: string): string => {
  const isWin = process.platform === 'win32';
  return isWin 
    ? path.join(venvDir, 'Scripts', `${binaryName}.exe`) 
    : path.join(venvDir, 'bin', binaryName);
};

const EXECUTABLE_WHITELIST = ['npm', 'git', 'pytest', 'eslint', 'prettier'];

interface ToolArgs {
  command?: string;
  cwd?: string;
  path?: string;
  content?: string;
  old_string?: string;
  new_string?: string;
  pattern?: string;
  directory?: string;
  filePath?: string;
  linter?: string;
  testCommand?: string;
  executable?: string;
  args?: string[];
  formatter?: string;
  manager?: string;
  packages?: string[] | string;
  gitArgs?: string;
  staged?: boolean;
  compareWith?: string;
  limit?: number;
  startLine?: number;
  endLine?: number;
  paths?: string[];
  discardAllUnstaged?: boolean;
  action?: string;
  branchName?: string;
  baseBranch?: string;
  message?: string;
  stageAll?: boolean;
  scriptName?: string;
  useTsx?: boolean;
  fix?: boolean;
  sourceDir?: string;
  buildDir?: string;
  buildType?: 'Debug' | 'Release' | 'RelWithDebInfo' | 'MinSizeRel';
  generator?: 'Ninja' | 'Unix Makefiles';
  cmakeArgs?: string[];
  target?: string;
  parallel?: boolean;
  cleanFirst?: boolean;
  testNamePattern?: string;
  parallelJobs?: number;
  pristineRebuild?: boolean;
  jobs?: number;
  makefile?: string;
  variables?: string[];
  compiler?: 'gcc' | 'g++' | 'clang' | 'clang++';
  srcFile?: string;
  outFile?: string;
  includeDirs?: string[];
  linkLibs?: string[];
  tool?: 'cppcheck' | 'clang-tidy';
  extraArgs?: string[];
  flags?: string[];
  fileExtensions?: string[];
  caseInsensitive?: boolean;
  findPattern?: string;
  replacement?: string;
  isRegex?: boolean;
  type?: 'file' | 'directory';
  minSize?: string;
  maxSize?: string;
  modifiedWithin?: string;
  venvPath?: string;
  requirementsFile?: string;
  packageName?: string;
  sourceFiles?: string[];
  className?: string;
  classPath?: string;
  system?: 'maven' | 'gradle';
  projectPath?: string;
  configuration?: 'Debug' | 'Release';
  buildTarget?: 'apk' | 'appbundle' | 'ios' | 'web' | 'macos' | 'windows' | 'linux';
  template?: 'react' | 'nextjs' | 'flutter' | 'dotnet-console' | 'aspnet-webapi' | 'aspnet-mvc' | 'maven-quickstart' | 'gradle-java' | 'flask' | 'django';
  outputDir?: string;
  projectName?: string;
}

/**
 * Execute a built‑in tool call by name.
 * Returns a string with the result or an error message.
 */
export async function executeToolCall(
  name: string,
  args: ToolArgs
): Promise<string> {
  switch (name) {
    // -----------------------------------------------------------------------
    // SHELL EXECUTION
    // -----------------------------------------------------------------------
    case 'shell_exec': {
      const cmd = args.command as string;
      if (!cmd) return 'Error: no command provided.';
      // Security: Validate command doesn't contain dangerous patterns
      const blockedPattern = containsDangerousPatterns(cmd);
      if (blockedPattern) {
        return `Error: Command blocked by security policy. Pattern "${blockedPattern}" is not allowed.`;
      }
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: args.cwd || cwd, maxBuffer: 10 * 1024 * 1024, timeout: 60000 },
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
      const filePath = path.resolve(args.path as string);
      try {
        const ignoreFilter = await loadIgnoreFilter(cwd);
        if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
          return `Error: File "${filePath}" is ignored by ignore rules.`;
        }
        const content = await fs.readFile(filePath, 'utf8');
        return content;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // FILE WRITING (overwrite)
    // -----------------------------------------------------------------------
    case 'file_write': {
      const filePath = path.resolve(args.path as string);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path "${filePath}" is ignored.`;
      }
      try {
        await fs.outputFile(filePath, args.content as string, 'utf8');
        return `File written: ${filePath}`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // FILE EDIT (replace first occurrence of a string)
    // -----------------------------------------------------------------------
    case 'file_edit': {
      const filePath = path.resolve(args.path as string);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, filePath))) {
        return `Error: Path "${filePath}" is ignored.`;
      }
      try {
        let content = await fs.readFile(filePath, 'utf8');
        if (!content.includes(args.old_string as string)) {
          return `Error: old_string not found in file.`;
        }
        content = content.replace(args.old_string as string, args.new_string as string);
        await fs.writeFile(filePath, content, 'utf8');
        return `File edited: ${filePath}`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
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
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
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
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // RUN LINTER
    // -----------------------------------------------------------------------
    case 'run_linter': {
      const { filePath, linter, cwd: wd } = args;
      if (!filePath || !linter) return 'Error: filePath and linter required.';
      // Security: Validate linter and filePath don't contain dangerous patterns
      const linterBlocked = containsDangerousPatterns(`${linter} ${filePath}`);
      if (linterBlocked) {
        return `Error: Command blocked by security policy. Pattern "${linterBlocked}" is not allowed.`;
      }
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
      // Security: Validate testCommand doesn't contain dangerous patterns
      const testBlocked = containsDangerousPatterns(testCommand as string);
      if (testBlocked) {
        return `Error: Command blocked by security policy. Pattern "${testBlocked}" is not allowed.`;
      }
      return new Promise((resolve) => {
        exec(
          testCommand as string,
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
    // EXEC FILE (whitelist-restricted)
    // -----------------------------------------------------------------------
    case 'exec_file': {
      const executable = args.executable;
      const execArgs = args.args || [];
      if (!executable) return 'Error: executable not specified.';
      if (!EXECUTABLE_WHITELIST.includes(executable)) {
        return `Error: executable "${executable}" is not allowed.`;
      }
      return new Promise((resolve) => {
        execFile(
          executable,
          execArgs,
          { cwd: args.cwd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Error: ${err.message}\n${stderr}`);
            else resolve(stdout || stderr || '(no output)');
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
      // Security: Validate package names - only allow alphanumeric, hyphens, dots, slashes, @, and spaces
      const pkgArray = Array.isArray(packages) ? packages : [packages];
      const validPkgPattern = /^[@a-zA-Z0-9._\/-]+$/;
      const invalidPkgs = pkgArray.filter((p: string) => !validPkgPattern.test(p));
      if (invalidPkgs.length > 0) {
        return `Error: Invalid package names detected: ${invalidPkgs.join(', ')}. Package names can only contain alphanumeric characters, hyphens, dots, slashes, and @.`;
      }
      // Security: Validate manager name
      const allowedManagers = ['npm', 'yarn', 'pnpm', 'pip', 'pip3', 'poetry', 'cargo', 'go', 'gem', 'composer'];
      if (!allowedManagers.includes(manager as string)) {
        return `Error: Package manager "${manager}" is not allowed. Allowed: ${allowedManagers.join(', ')}`;
      }
      return new Promise((resolve) => {
        execFile(
          manager as string,
          ['install', ...pkgArray],
          { cwd: (wd as string) || cwd, maxBuffer: 10 * 1024 * 1024 },
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
      // Security: Validate gitArgs doesn't contain dangerous patterns
      const gitBlocked = containsDangerousPatterns(`git ${gitArgs}`);
      if (gitBlocked) {
        return `Error: Command blocked by security policy. Pattern "${gitBlocked}" is not allowed.`;
      }
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
      if (!args.path) return 'Error: path required for create_directory';
      const dirPath = path.resolve(args.path as string);
      try {
        await fs.ensureDir(dirPath);
        return `Directory created: ${dirPath}`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // DELETE FILE OR DIRECTORY
    // -----------------------------------------------------------------------
    case 'delete_file_or_dir': {
      if (!args.path) return 'Error: path required for delete_file_or_dir';
      const targetPath = path.resolve(args.path as string);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      if (ignoreFilter.ignores(path.relative(cwd, targetPath))) {
        return `Error: Path "${targetPath}" is ignored.`;
      }
      try {
        await fs.remove(targetPath);
        return `Deleted: ${targetPath}`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // GIT STATUS
    // -----------------------------------------------------------------------
    case 'git_status': {
      const { cwd: wd } = args;
      return runGit(['status'], wd);
    }

    // -----------------------------------------------------------------------
    // GIT DIFF
    // -----------------------------------------------------------------------
    case 'git_diff': {
      const { staged, compareWith, filePath, cwd: wd } = args;
      const gitArgs = ['diff'];
      if (staged) {
        gitArgs.push('--cached');
      }
      if (compareWith) {
        gitArgs.push(compareWith);
      }
      if (filePath) {
        gitArgs.push('--', filePath);
      }
      return runGit(gitArgs, wd);
    }

    // -----------------------------------------------------------------------
    // GIT LOG
    // -----------------------------------------------------------------------
    case 'git_log': {
      const { limit, filePath, cwd: wd } = args;
      const count = limit !== undefined ? limit : 10;
      const gitArgs = ['log', `-${count}`, '--oneline'];
      if (filePath) {
        gitArgs.push('--', filePath);
      }
      return runGit(gitArgs, wd);
    }

    // -----------------------------------------------------------------------
    // GIT BLAME
    // -----------------------------------------------------------------------
    case 'git_blame': {
      const { filePath, startLine, endLine, cwd: wd } = args;
      if (!filePath) return 'Error: filePath is required for git_blame.';
      const gitArgs = ['blame'];
      if (startLine !== undefined && endLine !== undefined) {
        gitArgs.push('-L', `${startLine},${endLine}`);
      } else if (startLine !== undefined) {
        gitArgs.push('-L', `${startLine},`);
      }
      gitArgs.push(filePath);
      return runGit(gitArgs, wd);
    }

    // -----------------------------------------------------------------------
    // GIT DISCARD CHANGES
    // -----------------------------------------------------------------------
    case 'git_discard_changes': {
      const { paths, discardAllUnstaged, cwd: wd } = args;
      if (discardAllUnstaged) {
        return runGit(['restore', '.'], wd);
      } else if (paths && paths.length > 0) {
        return runGit(['restore', ...paths], wd);
      } else {
        return 'Error: either paths or discardAllUnstaged must be specified.';
      }
    }

    // -----------------------------------------------------------------------
    // GIT MANAGE BRANCH
    // -----------------------------------------------------------------------
    case 'git_manage_branch': {
      const { action, branchName, baseBranch, cwd: wd } = args;
      if (!action) return 'Error: action is required for git_manage_branch.';
      if (action === 'list') {
        return runGit(['branch'], wd);
      }
      if (!branchName) return `Error: branchName is required for ${action} action.`;
      
      if (action === 'create') {
        const gitArgs = ['branch', branchName];
        if (baseBranch) {
          gitArgs.push(baseBranch);
        }
        return runGit(gitArgs, wd);
      }
      if (action === 'checkout') {
        return runGit(['checkout', branchName], wd);
      }
      if (action === 'delete') {
        return runGit(['branch', '-d', branchName], wd);
      }
      return `Error: invalid branch action "${action}".`;
    }

    // -----------------------------------------------------------------------
    // GIT COMMIT
    // -----------------------------------------------------------------------
    case 'git_commit': {
      const { message, paths, stageAll, cwd: wd } = args;
      if (!message) return 'Error: message is required for git_commit.';
      
      if (stageAll) {
        const addResult = await runGit(['add', '-A'], wd);
        if (addResult.startsWith('Git error:')) {
          return `Error staging all files: ${addResult}`;
        }
      } else if (paths && paths.length > 0) {
        const addResult = await runGit(['add', ...paths], wd);
        if (addResult.startsWith('Git error:')) {
          return `Error staging paths: ${addResult}`;
        }
      }
      
      return runGit(['commit', '-m', message], wd);
    }

    // -----------------------------------------------------------------------
    // NPM LIST DEPENDENCIES
    // -----------------------------------------------------------------------
    case 'npm_list_dependencies': {
      const { cwd: wd } = args;
      return runNpm(['list', '--depth=0'], wd);
    }

    // -----------------------------------------------------------------------
    // NPM AUDIT
    // -----------------------------------------------------------------------
    case 'npm_audit': {
      const { fix, cwd: wd } = args;
      const npmArgs = ['audit'];
      if (fix) {
        npmArgs.push('fix');
      }
      return runNpm(npmArgs, wd);
    }

    // -----------------------------------------------------------------------
    // NPM CHECK OUTDATED
    // -----------------------------------------------------------------------
    case 'npm_check_outdated': {
      const { cwd: wd } = args;
      return runNpm(['outdated'], wd);
    }

    // -----------------------------------------------------------------------
    // NPM RUN SCRIPT
    // -----------------------------------------------------------------------
    case 'npm_run_script': {
      const { scriptName, cwd: wd } = args;
      if (!scriptName) return 'Error: scriptName is required for npm_run_script.';
      return runNpm(['run', scriptName], wd);
    }

    // -----------------------------------------------------------------------
    // NODE RUN FILE
    // -----------------------------------------------------------------------
    case 'node_run_file': {
      const { filePath, args: fileArgs, useTsx, cwd: wd } = args;
      if (!filePath) return 'Error: filePath is required for node_run_file.';
      const resolvedPath = path.resolve(wd || cwd, filePath);
      const argList = fileArgs || [];
      const escapedArgs = argList.map(a => `"${a.replace(/(["\\$])/g, '\\$1')}"`).join(' ');
      const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      const runWithTsx = useTsx !== false && isTs;
      const cmd = runWithTsx 
        ? `npx tsx "${resolvedPath}" ${escapedArgs}` 
        : `node "${resolvedPath}" ${escapedArgs}`;
      // Security: Validate the command doesn't contain dangerous patterns
      const nodeBlocked = containsDangerousPatterns(cmd);
      if (nodeBlocked) {
        return `Error: Command blocked by security policy. Pattern "${nodeBlocked}" is not allowed.`;
      }
      
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Execution error:\n${stderr || err.message}\nSTDOUT:\n${stdout}`);
            else resolve(stdout || stderr || 'Executed successfully with no output.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // NODE GET INFO
    // -----------------------------------------------------------------------
    case 'node_get_info': {
      const { cwd: wd } = args;
      const getVer = (cmd: string): Promise<string> => {
        return new Promise((resolve) => {
          exec(cmd, { cwd: wd || cwd }, (err, stdout) => {
            resolve(err ? 'not installed' : stdout.trim());
          });
        });
      };
      const nodeVer = await getVer('node -v');
      const npmVer = await getVer('npm -v');
      const yarnVer = await getVer('yarn -v');
      const osType = process.platform;
      const osArch = process.arch;
      return [
        `Node.js: ${nodeVer}`,
        `NPM: ${npmVer}`,
        `Yarn: ${yarnVer}`,
        `OS Platform: ${osType}`,
        `OS Architecture: ${osArch}`,
      ].join('\n');
    }

    // -----------------------------------------------------------------------
    // CMAKE CONFIGURE
    // -----------------------------------------------------------------------
    case 'cmake_configure': {
      const { sourceDir, buildDir, buildType, generator, cmakeArgs, cwd: wd } = args;
      const sDir = sourceDir || '.';
      const bDir = buildDir || 'build';
      const bType = buildType || 'Debug';
      const gen = generator || 'Ninja';
      const extraArgs = cmakeArgs || [];
      
      const configureArgs = [
        '-S', sDir,
        '-B', bDir,
        '-G', gen,
        `-DCMAKE_BUILD_TYPE=${bType}`,
        ...extraArgs
      ];
      return runCmake(configureArgs, wd);
    }

    // -----------------------------------------------------------------------
    // CMAKE BUILD
    // -----------------------------------------------------------------------
    case 'cmake_build': {
      const { buildDir, target, parallel, cleanFirst, cwd: wd } = args;
      const bDir = buildDir || 'build';
      const buildArgs = ['--build', bDir];
      if (cleanFirst) {
        buildArgs.push('--clean-first');
      }
      if (parallel !== false) {
        buildArgs.push('--parallel');
      }
      if (target) {
        buildArgs.push('--target', target);
      }
      return runCmake(buildArgs, wd);
    }

    // -----------------------------------------------------------------------
    // CMAKE RUN TESTS (ctest)
    // -----------------------------------------------------------------------
    case 'cmake_run_tests': {
      const { buildDir, testNamePattern, parallelJobs, cwd: wd } = args;
      const bDir = buildDir || 'build';
      const ctestArgs = ['--test-dir', bDir];
      if (testNamePattern) {
        ctestArgs.push('-R', testNamePattern);
      }
      if (parallelJobs !== undefined) {
        ctestArgs.push('-j', String(parallelJobs));
      } else {
        ctestArgs.push('-j');
      }
      return runCtest(ctestArgs, wd);
    }

    // -----------------------------------------------------------------------
    // CMAKE CLEAN
    // -----------------------------------------------------------------------
    case 'cmake_clean': {
      const { buildDir, pristineRebuild, cwd: wd } = args;
      const bDir = buildDir || 'build';
      const resolvedBuildDir = path.resolve(wd || cwd, bDir);
      
      if (pristineRebuild) {
        try {
          await fs.remove(resolvedBuildDir);
          return `Build directory ${resolvedBuildDir} successfully removed.`;
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          return `Error removing build directory: ${errMsg}`;
        }
      } else {
        return runCmake(['--build', bDir, '--target', 'clean'], wd);
      }
    }

    // -----------------------------------------------------------------------
    // MAKE RUN
    // -----------------------------------------------------------------------
    case 'make_run': {
      const { target, jobs, makefile, variables, cwd: wd } = args;
      const makeArgs: string[] = [];
      if (makefile) {
        makeArgs.push('-f', makefile);
      }
      if (jobs !== undefined) {
        makeArgs.push('-j', String(jobs));
      }
      if (variables && variables.length > 0) {
        makeArgs.push(...variables);
      }
      if (target) {
        makeArgs.push(target);
      }
      return runExecutable('make', makeArgs, wd);
    }

    // -----------------------------------------------------------------------
    // C COMPILE FILE
    // -----------------------------------------------------------------------
    case 'c_compile_file': {
      const { compiler, srcFile, outFile, includeDirs, flags, linkLibs, cwd: wd } = args;
      if (!compiler) return 'Error: compiler is required for c_compile_file.';
      if (!srcFile) return 'Error: srcFile is required for c_compile_file.';
      
      const compileArgs: string[] = [];
      
      if (includeDirs && includeDirs.length > 0) {
        includeDirs.forEach(dir => compileArgs.push(`-I${dir}`));
      }
      
      if (flags && flags.length > 0) {
        compileArgs.push(...flags);
      }
      
      compileArgs.push(srcFile);
      
      if (outFile) {
        compileArgs.push('-o', outFile);
      }
      
      if (linkLibs && linkLibs.length > 0) {
        compileArgs.push(...linkLibs);
      }
      
      return runExecutable(compiler, compileArgs, wd);
    }

    // -----------------------------------------------------------------------
    // C ANALYZE CODE
    // -----------------------------------------------------------------------
    case 'c_analyze_code': {
      const { filePath, tool, extraArgs, cwd: wd } = args;
      if (!filePath) return 'Error: filePath is required for c_analyze_code.';
      
      const checker = tool || 'cppcheck';
      const checkerArgs: string[] = [];
      
      if (checker === 'cppcheck') {
        checkerArgs.push('--enable=all', '--inconclusive');
      }
      
      if (extraArgs && extraArgs.length > 0) {
        checkerArgs.push(...extraArgs);
      }
      
      checkerArgs.push(filePath);
      return runExecutable(checker, checkerArgs, wd);
    }

    // -----------------------------------------------------------------------
    // GREP REGEX
    // -----------------------------------------------------------------------
    case 'grep_regex': {
      const pattern = args.pattern as string;
      if (!pattern) return 'Error: pattern is required for grep_regex.';
      const searchDir = path.resolve(args.directory || cwd);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      const results: string[] = [];
      const flags = args.caseInsensitive ? 'i' : '';
      const regex = new RegExp(pattern, flags);
      const extensions = args.fileExtensions || [];
      
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
              if (extensions.length > 0) {
                const ext = path.extname(entry.name).slice(1);
                if (!extensions.includes(ext)) continue;
              }
              try {
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                  if (regex.test(line)) {
                    results.push(`${relPath}:${index + 1}: ${line.trim()}`);
                  }
                });
              } catch {
                // skip unreadable files
              }
            }
          }
        };
        await walk(searchDir);
        return results.length ? results.join('\n') : 'No regex matches found.';
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // GREP FIND AND REPLACE
    // -----------------------------------------------------------------------
    case 'grep_find_and_replace': {
      const findPattern = args.findPattern;
      const replacement = args.replacement;
      if (findPattern === undefined || replacement === undefined) {
        return 'Error: findPattern and replacement are required for grep_find_and_replace.';
      }
      const searchDir = path.resolve(args.directory || cwd);
      const ignoreFilter = await loadIgnoreFilter(cwd);
      const extensions = args.fileExtensions || [];
      let modifiedFilesCount = 0;
      
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const findRule = args.isRegex 
        ? new RegExp(findPattern, 'g') 
        : new RegExp(escapeRegExp(findPattern), 'g');
      
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
              if (extensions.length > 0) {
                const ext = path.extname(entry.name).slice(1);
                if (!extensions.includes(ext)) continue;
              }
              try {
                const content = await fs.readFile(fullPath, 'utf8');
                if (findRule.test(content)) {
                  findRule.lastIndex = 0;
                  const updatedContent = content.replace(findRule, replacement);
                  await fs.writeFile(fullPath, updatedContent, 'utf8');
                  modifiedFilesCount++;
                }
              } catch {
                // skip unreadable files
              }
            }
          }
        };
        await walk(searchDir);
        return `Successfully modified ${modifiedFilesCount} file(s).`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // FILE FIND BY METADATA
    // -----------------------------------------------------------------------
    case 'file_find_by_metadata': {
      const { directory, type: filterType, minSize, maxSize, modifiedWithin, cwd: wd } = args;
      const searchDir = path.resolve(wd || cwd, directory || '.');
      const ignoreFilter = await loadIgnoreFilter(cwd);
      const results: string[] = [];
      
      const parseSize = (sizeStr: string): number => {
        const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'kb') return val * 1024;
        if (unit === 'mb') return val * 1024 * 1024;
        if (unit === 'gb') return val * 1024 * 1024 * 1024;
        return val;
      };
      
      const parseDuration = (durStr: string): number => {
        const match = durStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/);
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'm') return val * 60 * 1000;
        if (unit === 'h') return val * 60 * 60 * 1000;
        if (unit === 'd') return val * 24 * 60 * 60 * 1000;
        return 0;
      };
      
      const minSizeBytes = minSize ? parseSize(minSize) : 0;
      const maxSizeBytes = maxSize ? parseSize(maxSize) : Infinity;
      const modDurationMs = modifiedWithin ? parseDuration(modifiedWithin) : Infinity;
      
      try {
        const walk = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(cwd, fullPath);
            if (ignoreFilter.ignores(relPath)) continue;
            
            const isDir = entry.isDirectory();
            const isFile = entry.isFile();
            
            if (filterType === 'file' && !isFile) continue;
            if (filterType === 'directory' && !isDir) continue;
            
            try {
              const stat = await fs.stat(fullPath);
              
              if (isFile) {
                if (stat.size < minSizeBytes || stat.size > maxSizeBytes) continue;
              }
              
              if (modDurationMs !== Infinity) {
                if (Date.now() - stat.mtimeMs > modDurationMs) continue;
              }
              
              results.push(relPath);
            } catch {
              // skip unreadable files
            }
            
            if (isDir) {
              await walk(fullPath);
            }
          }
        };
        await walk(searchDir);
        return results.length ? results.join('\n') : 'No matching files found.';
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return `Error: ${errMsg}`;
      }
    }

    // -----------------------------------------------------------------------
    // PYTHON CREATE VENV
    // -----------------------------------------------------------------------
    case 'python_create_venv': {
      const { venvPath, cwd: wd } = args;
      const vPath = venvPath || '.venv';
      return new Promise((resolve) => {
        execFile(
          'python3',
          ['-m', 'venv', vPath],
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, _stdout, _stderr) => {
            if (err) {
              execFile(
                'python',
                ['-m', 'venv', vPath],
                { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
                (err2, _stdout2, stderr2) => {
                  if (err2) {
                    resolve(`Error creating venv: ${stderr2 || err2.message}`);
                  } else {
                    resolve(`Virtual environment created at ${vPath}`);
                  }
                }
              );
            } else {
              resolve(`Virtual environment created at ${vPath}`);
            }
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // PYTHON INSTALL REQUIREMENTS
    // -----------------------------------------------------------------------
    case 'python_install_requirements': {
      const { requirementsFile, packages, venvPath, cwd: wd } = args;
      const vPath = venvPath || '.venv';
      const pipBin = getVenvBinary(path.resolve(wd || cwd, vPath), 'pip');
      
      const pipArgs = ['install'];
      if (packages && packages.length > 0) {
        pipArgs.push(...packages);
      } else {
        const reqFile = requirementsFile || 'requirements.txt';
        pipArgs.push('-r', reqFile);
      }
      
      return new Promise((resolve) => {
        execFile(
          pipBin,
          pipArgs,
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Pip installation error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
            else resolve(stdout || stderr || 'Packages installed successfully.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // PYTHON LIST PACKAGES
    // -----------------------------------------------------------------------
    case 'python_list_packages': {
      const { venvPath, cwd: wd } = args;
      const vPath = venvPath || '.venv';
      const pipBin = getVenvBinary(path.resolve(wd || cwd, vPath), 'pip');
      return new Promise((resolve) => {
        execFile(
          pipBin,
          ['list'],
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Pip list error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
            else resolve(stdout || stderr || 'No packages found.');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // PYTHON RUN FILE
    // -----------------------------------------------------------------------
    case 'python_run_file': {
      const { filePath, args: pyArgs, venvPath, cwd: wd } = args;
      if (!filePath) return 'Error: filePath is required for python_run_file.';
      const vPath = venvPath || '.venv';
      const pythonBin = getVenvBinary(path.resolve(wd || cwd, vPath), 'python');
      const fileArgs = pyArgs || [];
      
      return new Promise((resolve) => {
        execFile(
          pythonBin,
          [filePath, ...fileArgs],
          { cwd: wd || cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) resolve(`Python execution error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
            else resolve(stdout || stderr || 'Success');
          }
        );
      });
    }

    // -----------------------------------------------------------------------
    // PIP SHOW PACKAGE
    // -----------------------------------------------------------------------
    case 'pip_show_package': {
      const { packageName, venvPath, cwd: wd } = args;
      if (!packageName) return 'Error: packageName is required for pip_show_package.';
      const vPath = venvPath || '.venv';
      const pipBin = getVenvBinary(path.resolve(wd || cwd, vPath), 'pip');
      return runExecutable(pipBin, ['show', packageName], wd);
    }

    // -----------------------------------------------------------------------
    // JAVA COMPILE AND RUN
    // -----------------------------------------------------------------------
    case 'java_compile_and_run': {
      const { action, sourceFiles, className, classPath, args: javaArgs, cwd: wd } = args;
      if (!action) return 'Error: action is required for java_compile_and_run.';
      
      if (action === 'compile') {
        if (!sourceFiles || sourceFiles.length === 0) {
          return 'Error: sourceFiles required for java compile action.';
        }
        const javacArgs: string[] = [];
        if (classPath) {
          javacArgs.push('-cp', classPath);
        }
        javacArgs.push(...sourceFiles);
        return runExecutable('javac', javacArgs, wd);
      } else if (action === 'run') {
        if (!className) {
          return 'Error: className required for java run action.';
        }
        const javaExecArgs: string[] = [];
        if (classPath) {
          javaExecArgs.push('-cp', classPath);
        }
        javaExecArgs.push(className);
        if (javaArgs && javaArgs.length > 0) {
          javaExecArgs.push(...javaArgs);
        }
        return runExecutable('java', javaExecArgs, wd);
      }
      return `Error: invalid action "${action}".`;
    }

    // -----------------------------------------------------------------------
    // JAVA PROJECT BUILD
    // -----------------------------------------------------------------------
    case 'java_project_build': {
      const { system, target, cwd: wd } = args;
      if (!system) return 'Error: system is required for java_project_build.';
      
      if (system === 'maven') {
        const t = target || 'clean install';
        const mavenArgs = t.trim().split(/\s+/);
        return runExecutable('mvn', mavenArgs, wd);
      } else if (system === 'gradle') {
        const t = target || 'build';
        const gradleArgs = t.trim().split(/\s+/);
        const isWin = process.platform === 'win32';
        const localWrapper = isWin ? 'gradlew.bat' : 'gradlew';
        const localWrapperPath = path.resolve(wd || cwd, localWrapper);
        const hasWrapper = await fs.pathExists(localWrapperPath);
        
        const gradleBin = hasWrapper ? localWrapperPath : 'gradle';
        return runExecutable(gradleBin, gradleArgs, wd);
      }
      return `Error: invalid build system "${system}".`;
    }

    // -----------------------------------------------------------------------
    // .NET COMMAND
    // -----------------------------------------------------------------------
    case 'dotnet_command': {
      const { action, projectPath, configuration, extraArgs, cwd: wd } = args;
      if (!action) return 'Error: action is required for dotnet_command.';
      
      const dotnetArgs = [action];
      if (projectPath) {
        dotnetArgs.push(projectPath);
      }
      if (configuration) {
        dotnetArgs.push('-c', configuration);
      }
      if (extraArgs && extraArgs.length > 0) {
        dotnetArgs.push(...extraArgs);
      }
      return runExecutable('dotnet', dotnetArgs, wd);
    }

    // -----------------------------------------------------------------------
    // FLUTTER COMMAND
    // -----------------------------------------------------------------------
    case 'flutter_command': {
      const { action, buildTarget, extraArgs, cwd: wd } = args;
      if (!action) return 'Error: action is required for flutter_command.';
      
      const flutterArgs = [action];
      if (action === 'build') {
        if (!buildTarget) {
          return 'Error: buildTarget is required for build action.';
        }
        flutterArgs.push(buildTarget);
      }
      if (extraArgs && extraArgs.length > 0) {
        flutterArgs.push(...extraArgs);
      }
      return runExecutable('flutter', flutterArgs, wd);
    }

    // -----------------------------------------------------------------------
    // CREATE PROJECT (SCAFFOLDING)
    // -----------------------------------------------------------------------
    case 'create_project': {
      const { template, projectName, outputDir, extraArgs, cwd: wd } = args;
      if (!template) return 'Error: template is required for create_project.';
      if (!projectName) return 'Error: projectName is required for create_project.';
      
      const parentDir = path.resolve(wd || cwd, outputDir || '.');
      
      // Handle Flask template custom logic (does not need binary commands)
      if (template === 'flask') {
        const targetDir = path.join(parentDir, projectName);
        try {
          await fs.ensureDir(targetDir);
          const appPy = [
            'from flask import Flask',
            'app = Flask(__name__)',
            '',
            '@app.route("/")',
            'def index():',
            '    return "Hello, Flask!"',
            '',
            'if __name__ == "__main__":',
            '    app.run(debug=True)',
          ].join('\n');
          await fs.writeFile(path.join(targetDir, 'app.py'), appPy, 'utf8');
          await fs.writeFile(path.join(targetDir, 'requirements.txt'), 'flask\n', 'utf8');
          return `Flask project "${projectName}" successfully scaffolded at ${targetDir}`;
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          return `Error scaffolding Flask project: ${errMsg}`;
        }
      }
      
      // Setup binaries and args for other templates
      let binary = '';
      let cmdArgs: string[] = [];
      const userExtra = extraArgs || [];
      
      if (template === 'react') {
        binary = 'npm';
        cmdArgs = ['create', 'vite@latest', projectName, '--', '--template', 'react', ...userExtra];
      } else if (template === 'nextjs') {
        binary = 'npx';
        cmdArgs = ['-y', 'create-next-app@latest', projectName, '--use-npm', '--typescript', '--eslint', '--src-dir', '--app', '--import-alias', '@/*', '--tailwind', ...userExtra];
      } else if (template === 'flutter') {
        binary = 'flutter';
        // Clean target name for Dart compliance
        const cleanName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        cmdArgs = ['create', '--project-name', cleanName, projectName, ...userExtra];
      } else if (template === 'dotnet-console') {
        binary = 'dotnet';
        cmdArgs = ['new', 'console', '-n', projectName, '-o', projectName, ...userExtra];
      } else if (template === 'aspnet-webapi') {
        binary = 'dotnet';
        cmdArgs = ['new', 'webapi', '-n', projectName, '-o', projectName, ...userExtra];
      } else if (template === 'aspnet-mvc') {
        binary = 'dotnet';
        cmdArgs = ['new', 'mvc', '-n', projectName, '-o', projectName, ...userExtra];
      } else if (template === 'maven-quickstart') {
        binary = 'mvn';
        cmdArgs = ['archetype:generate', '-DgroupId=com.example', `-DartifactId=${projectName}`, '-DarchetypeArtifactId=maven-archetype-quickstart', '-DinteractiveMode=false', ...userExtra];
      } else if (template === 'gradle-java') {
        binary = 'gradle';
        cmdArgs = ['init', '--type', 'java-application', '--dsl', 'groovy', '--project-name', projectName, ...userExtra];
      } else if (template === 'django') {
        binary = 'django-admin';
        cmdArgs = ['startproject', projectName, ...userExtra];
      } else {
        return `Error: unsupported project template "${template}".`;
      }
      
      // Ensure target parent directory exists before running the command
      await fs.ensureDir(parentDir);
      return runExecutable(binary, cmdArgs, parentDir);
    }

    // -----------------------------------------------------------------------
    // DEFAULT
    // -----------------------------------------------------------------------
    default:
      return `Unknown tool: ${name}`;
  }
}