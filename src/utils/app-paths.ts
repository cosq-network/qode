import fs from 'fs';
import os from 'os';
import path from 'path';

let cachedQodeHome: string | null = null;

export function getQodeHome(): string {
  if (cachedQodeHome) return cachedQodeHome;

  cachedQodeHome = process.env.QODE_HOME || path.join(os.homedir(), '.qode');
  return cachedQodeHome;
}

export function getQodeSubdir(...parts: string[]): string {
  return path.join(getQodeHome(), ...parts);
}

export function getWritableQodeHome(): string {
  const preferred = getQodeHome();
  try {
    fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const fallback = path.join(process.cwd(), '.qode');
    fs.mkdirSync(fallback, { recursive: true });
    const probe = path.join(fallback, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    cachedQodeHome = fallback;
    return fallback;
  }
}

export function getWritableQodeSubdir(...parts: string[]): string {
  const preferred = path.join(getQodeHome(), ...parts);
  try {
    fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const fallback = path.join(process.cwd(), '.qode', ...parts);
    fs.mkdirSync(fallback, { recursive: true });
    const probe = path.join(fallback, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    cachedQodeHome = path.join(process.cwd(), '.qode');
    return fallback;
  }
}
