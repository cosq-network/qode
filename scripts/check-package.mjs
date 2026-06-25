import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = await mkdtemp(path.join(tmpdir(), 'qode-npm-cache-'));

const { stdout } = await execFileAsync(
  'npm',
  ['pack', '--dry-run', '--json'],
  {
    cwd: root,
    env: {
      ...process.env,
      npm_config_cache: cacheDir,
    },
    maxBuffer: 10 * 1024 * 1024,
  },
);

const pack = JSON.parse(stdout)[0];
const files = new Set(pack.files.map((file) => file.path));

const required = [
  'dist/index.js',
  'dist/tools/ionic/index.js',
  'dist/tools/msbuild/index.js',
  'dist/tools/npx/index.js',
  'dist/tools/qemu/index.js',
  'dist/skills/ionic/SKILL.md',
  'dist/skills/msbuild/SKILL.md',
  'dist/skills/npx/SKILL.md',
  'dist/skills/qemu/SKILL.md',
];

const forbidden = [
  /^dist\/test\//,
  /^dist\/.*\.test\.js$/,
  /^src\//,
  /^scripts\//,
];

const missing = required.filter((file) => !files.has(file));
const forbiddenMatches = [...files].filter((file) => forbidden.some((pattern) => pattern.test(file)));

if (missing.length > 0 || forbiddenMatches.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing package files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  }
  if (forbiddenMatches.length > 0) {
    console.error(`Forbidden package files:\n${forbiddenMatches.map((file) => `- ${file}`).join('\n')}`);
  }
  process.exit(1);
}

console.log(`Package check passed: ${pack.files.length} files, ${pack.unpackedSize} unpacked bytes.`);
