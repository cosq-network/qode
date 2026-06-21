// src/utils/clipboard.ts
import { exec } from 'child_process';

export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let cmd = '';
    if (process.platform === 'darwin') {
      cmd = 'pbcopy';
    } else if (process.platform === 'win32') {
      cmd = 'clip';
    } else {
      cmd = 'xclip -selection clipboard';
    }

    const proc = exec(cmd, (err) => {
      resolve(!err);
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}

export function pasteFromClipboard(): Promise<string> {
  return new Promise((resolve) => {
    let cmd = '';
    if (process.platform === 'darwin') {
      cmd = 'pbpaste';
    } else if (process.platform === 'win32') {
      cmd = 'powershell -NoProfile -Command Get-Clipboard';
    } else {
      cmd = 'xclip -selection clipboard -o || xsel --clipboard --output';
    }

    exec(cmd, (err, stdout) => {
      if (err) {
        resolve('');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
