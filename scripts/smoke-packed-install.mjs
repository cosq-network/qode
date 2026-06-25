import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = await mkdtemp(path.join(tmpdir(), 'qode-packed-install-'));
const cacheDir = path.join(workspace, 'npm-cache');

const npmEnv = {
  ...process.env,
  npm_config_cache: cacheDir,
};

const { stdout: packStdout } = await execFileAsync(
  'npm',
  ['pack', '--json', '--pack-destination', workspace],
  { cwd: root, env: npmEnv, maxBuffer: 10 * 1024 * 1024 },
);
const tarball = path.join(workspace, JSON.parse(packStdout)[0].filename);

await execFileAsync('npm', ['init', '-y'], { cwd: workspace, env: npmEnv, maxBuffer: 1024 * 1024 });
try {
  await execFileAsync(
    'npm',
    ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--fund=false', tarball],
    {
      cwd: workspace,
      env: npmEnv,
      timeout: 120000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Packed install smoke failed during npm install: ${message}`);
  if (error && typeof error === 'object') {
    const details = error;
    if ('stdout' in details && details.stdout) console.error(String(details.stdout));
    if ('stderr' in details && details.stderr) console.error(String(details.stderr));
  }
  process.exit(1);
}

const { stdout } = await execFileAsync(
  path.join(workspace, 'node_modules', '.bin', process.platform === 'win32' ? 'qode.cmd' : 'qode'),
  ['--help'],
  {
    cwd: workspace,
    env: {
      ...process.env,
      QODE_SKIP_STARTUP_TASKS: '1',
    },
    maxBuffer: 1024 * 1024,
  },
);

if (!stdout.includes('Usage:') || !stdout.includes('qode')) {
  console.error('Packed install smoke failed: qode --help did not produce expected output.');
  process.exit(1);
}

console.log('Packed install smoke passed.');
