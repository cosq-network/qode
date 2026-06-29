import fs from 'fs-extra';
import path from 'path';
import { getRecentFiles } from './files.js';

export async function buildWorkspaceMap(cwd: string): Promise<string> {
  let output = '┌────────────────── Agentic Workspace Map ──────────────────┐\n';
  
  // 1. Configs
  output += '│ Configs:\n';
  const commonConfigs = ['package.json', 'tsconfig.json', 'tsconfig.build.json', 'eslint.config.js', 'jest.config.js', '.gitignore'];
  let configFound = false;
  for (const cfg of commonConfigs) {
    if (await fs.pathExists(path.join(cwd, cfg))) {
      output += `│   - ${cfg}\n`;
      configFound = true;
    }
  }
  if (!configFound) output += '│   (None detected)\n';
  
  // 2. Entry points
  output += '│ Entry Points (guessed):\n';
  const entryPoints = ['src/index.ts', 'src/main.ts', 'index.js', 'main.js', 'src/app.ts', 'src/cli.ts'];
  let entryFound = false;
  for (const ep of entryPoints) {
    if (await fs.pathExists(path.join(cwd, ep))) {
      output += `│   - ${ep}\n`;
      entryFound = true;
    }
  }
  if (!entryFound) output += '│   (None detected)\n';
  
  // 3. Tests (very shallow scan of src or root)
  output += '│ Tests:\n';
  try {
    const srcDir = path.join(cwd, 'src');
    if (await fs.pathExists(srcDir)) {
      const items = await fs.readdir(srcDir, { recursive: true, withFileTypes: true });
      const tests = items
        .filter(item => item.isFile() && (item.name.endsWith('.test.ts') || item.name.endsWith('.spec.ts')))
        .slice(0, 5); // limit to 5
      
      if (tests.length > 0) {
        for (const test of tests) {
           // path relative to src/
           const p = path.relative(cwd, path.join(test.path, test.name));
           output += `│   - ${p}\n`;
        }
        if (tests.length === 5) output += '│   - ... (more tests available)\n';
      } else {
        output += '│   (None detected in src/)\n';
      }
    } else {
      output += '│   (No src/ directory)\n';
    }
  } catch {
    output += '│   (Error scanning for tests)\n';
  }

  // 4. Recent Changes
  output += '│ Recent Changes:\n';
  const recentFiles = await getRecentFiles(cwd, 5);
  if (recentFiles.length > 0) {
    for (const file of recentFiles) {
      output += `│   - ${file}\n`;
    }
  } else {
    output += '│   (No recent files detected)\n';
  }

  output += '└───────────────────────────────────────────────────────────┘\n';
  return output;
}
