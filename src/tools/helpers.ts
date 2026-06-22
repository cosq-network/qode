import { exec, execFile } from 'child_process';
import path from 'path';

let cwd = process.cwd();

export function getCwd(): string {
  return cwd;
}

export function setCwd(newCwd: string): void {
  cwd = newCwd;
}

export const MAX_BUFFER = 10 * 1024 * 1024;

export const EXECUTABLE_WHITELIST = ['npm', 'git', 'pytest', 'eslint', 'prettier'];

export function runGit(gitArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'git',
      gitArgs,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
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

export function runNpm(npmArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'npm',
      npmArgs,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
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

export function runCmake(cmakeArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'cmake',
      cmakeArgs,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
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

export function runCtest(ctestArgs: string[], wd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'ctest',
      ctestArgs,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
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

export function runExecutable(
  binary: string,
  binaryArgs: string[],
  wd?: string
): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      binary,
      binaryArgs,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          resolve(
            `${binary} error: ${stderr || err.message}\nSTDOUT:\n${stdout}`
          );
        } else {
          resolve(stdout || stderr || 'Success');
        }
      }
    );
  });
}

export function runShell(
  command: string,
  wd?: string
): Promise<string> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd: wd || cwd, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) resolve(`Error: ${err.message}\n${stderr}`);
        else resolve(stdout || stderr || '(no output)');
      }
    );
  });
}

export function getVenvBinary(venvDir: string, binaryName: string): string {
  const isWin = process.platform === 'win32';
  return isWin
    ? path.join(venvDir, 'Scripts', `${binaryName}.exe`)
    : path.join(venvDir, 'bin', binaryName);
}
