import path from 'path';
import fs from 'fs-extra';
import ignore from 'ignore';

const { default: ignoreFactory } = ignore;

// Patterns always ignored
const ALWAYS_IGNORE = ['node_modules/**', '.git/**', '.cosqcode/**'];

export async function loadIgnoreFilter(cwd: string) {
  const ig = ignoreFactory();
  ig.add(ALWAYS_IGNORE);

  // Load .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf8');
    ig.add(content);
  }

  // Load .dockerignore
  const dockerignorePath = path.join(cwd, '.dockerignore');
  if (await fs.pathExists(dockerignorePath)) {
    const content = await fs.readFile(dockerignorePath, 'utf8');
    ig.add(content);
  }

  return ig;
}