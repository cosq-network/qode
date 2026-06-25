import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { stdout } = await execFileAsync(
  process.execPath,
  ['dist/index.js', '--help'],
  {
    cwd: root,
    env: {
      ...process.env,
      QODE_SKIP_STARTUP_TASKS: '1',
    },
    maxBuffer: 1024 * 1024,
  },
);

for (const expected of ['Usage:', 'qode', 'chat', 'models']) {
  if (!stdout.includes(expected)) {
    console.error(`CLI smoke failed: expected help output to include "${expected}".`);
    process.exit(1);
  }
}

console.log('CLI smoke passed.');
