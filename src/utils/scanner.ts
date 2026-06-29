import fs from 'fs-extra';
import path from 'path';

export async function detectTechStack(cwd: string): Promise<string[]> {
  const stack = new Set<string>();

  const hasFile = async (filename: string) => fs.pathExists(path.join(cwd, filename));
  const readFile = async (filename: string) => fs.readFile(path.join(cwd, filename), 'utf8');

  // Node.js ecosystem
  if (await hasFile('package.json')) {
    stack.add('node');
    try {
      const pkg = JSON.parse(await readFile('package.json'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      if (deps['react']) stack.add('react');
      if (deps['vue']) stack.add('vue');
      if (deps['next']) stack.add('nextjs');
      if (deps['express']) stack.add('express');
      if (deps['typescript']) stack.add('typescript');
      if (deps['jest']) stack.add('jest');
    } catch {}
  }

  if (await hasFile('tsconfig.json')) stack.add('typescript');

  // Python ecosystem
  if (await hasFile('requirements.txt') || await hasFile('Pipfile') || await hasFile('pyproject.toml')) {
    stack.add('python');
    try {
      if (await hasFile('requirements.txt')) {
        const reqs = (await readFile('requirements.txt')).toLowerCase();
        if (reqs.includes('django')) stack.add('django');
        if (reqs.includes('flask')) stack.add('flask');
        if (reqs.includes('fastapi')) stack.add('fastapi');
      }
    } catch {}
  }

  // Go
  if (await hasFile('go.mod')) stack.add('go');

  // Java
  if (await hasFile('pom.xml') || await hasFile('build.gradle')) stack.add('java');

  // Rust
  if (await hasFile('Cargo.toml')) stack.add('rust');

  // Docker
  if (await hasFile('docker-compose.yml') || await hasFile('Dockerfile')) stack.add('docker');

  return Array.from(stack);
}
