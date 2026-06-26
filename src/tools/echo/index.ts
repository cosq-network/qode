import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool, ToolResult } from '../registry.js';

type ShellName = 'bash' | 'zsh';
type EchoAction = 'set_env' | 'add_path';

const SHELL_RC_FILES: Record<ShellName, string> = {
  bash: '.bashrc',
  zsh: '.zshrc',
};

function normalizeShells(value: unknown): ShellName[] {
  const requested = Array.isArray(value) ? value : ['bash', 'zsh'];
  const shells = requested.filter((shell): shell is ShellName => shell === 'bash' || shell === 'zsh');
  return Array.from(new Set(shells));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function markerFor(action: EchoAction, key: string): string {
  const digest = crypto.createHash('sha256').update(`${action}:${key}`).digest('hex').slice(0, 12);
  return `qode echo ${action} ${digest}`;
}

function upsertManagedBlock(content: string, marker: string, blockLines: string[]): { content: string; changed: boolean } {
  const block = [`# >>> ${marker}`, ...blockLines, `# <<< ${marker}`].join('\n');
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(`(?:\\n|^)# >>> ${escapedMarker}\\n[\\s\\S]*?\\n# <<< ${escapedMarker}(?=\\n|$)`);

  if (blockPattern.test(content)) {
    const next = content.replace(blockPattern, (match) => {
      const prefix = match.startsWith('\n') ? '\n' : '';
      return `${prefix}${block}`;
    });
    return { content: next, changed: next !== content };
  }

  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return { content: `${content}${suffix}${block}\n`, changed: true };
}

export async function updateShellEnvironment(args: Record<string, unknown>): Promise<ToolResult> {
  const action = args.action as EchoAction | undefined;
  const shells = normalizeShells(args.shells);
  const homeDir = typeof args.homeDir === 'string' && args.homeDir.trim() ? args.homeDir : os.homedir();

  if (action !== 'set_env' && action !== 'add_path') {
    return { output: '', error: 'action must be "set_env" or "add_path".' };
  }
  if (shells.length === 0) {
    return { output: '', error: 'shells must include "bash", "zsh", or both.' };
  }

  let marker: string;
  let blockLines: string[];
  if (action === 'set_env') {
    const variable = args.variable as string | undefined;
    const value = args.value as string | undefined;
    if (!variable || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
      return { output: '', error: 'variable must be a valid shell environment variable name.' };
    }
    if (typeof value !== 'string' || value.includes('\n')) {
      return { output: '', error: 'value must be a single-line string.' };
    }
    marker = markerFor(action, variable);
    blockLines = [`export ${variable}=${shellQuote(value)}`];
  } else {
    const pathEntry = args.pathEntry as string | undefined;
    const mode = args.mode === 'append' ? 'append' : 'prepend';
    if (!pathEntry || pathEntry.includes('\n')) {
      return { output: '', error: 'pathEntry must be a non-empty single-line string.' };
    }
    marker = markerFor(action, `${mode}:${pathEntry}`);
    blockLines = mode === 'append'
      ? [`export PATH="$PATH":${shellQuote(pathEntry)}`]
      : [`export PATH=${shellQuote(pathEntry)}:"$PATH"`];
  }

  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];

  for (const shell of shells) {
    const rcFile = path.join(homeDir, SHELL_RC_FILES[shell]);
    await fs.ensureFile(rcFile);
    const existing = await fs.readFile(rcFile, 'utf8');
    const next = upsertManagedBlock(existing, marker, blockLines);
    if (next.changed) {
      await fs.writeFile(rcFile, next.content, 'utf8');
      changedFiles.push(rcFile);
    } else {
      unchangedFiles.push(rcFile);
    }
  }

  const lines = [
    `Updated shell environment using echo-style export block for ${shells.join(', ')}.`,
    changedFiles.length ? `Changed: ${changedFiles.join(', ')}` : '',
    unchangedFiles.length ? `Already current: ${unchangedFiles.join(', ')}` : '',
    'Open a new terminal or source the updated rc file for changes to apply.',
  ].filter(Boolean);

  return {
    output: lines.join('\n'),
    metadata: { action, shells, changedFiles, unchangedFiles },
  };
}

const echoUpdateShellEnv: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'echo_update_shell_env',
      description: 'Persistently update bash and/or zsh environment variables or PATH entries by writing managed echo/export blocks to shell rc files.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['set_env', 'add_path'], description: 'Use set_env to export a variable, or add_path to add a PATH entry.' },
          shells: { type: 'array', items: { type: 'string', enum: ['bash', 'zsh'] }, description: 'Shell startup files to update. Defaults to both bash and zsh.' },
          variable: { type: 'string', description: 'Environment variable name for set_env.' },
          value: { type: 'string', description: 'Environment variable value for set_env.' },
          pathEntry: { type: 'string', description: 'Directory to add to PATH for add_path.' },
          mode: { type: 'string', enum: ['prepend', 'append'], description: 'Whether to prepend or append pathEntry. Defaults to prepend.' },
        },
        required: ['action'],
      } as any,
    },
  },
  metadata: { category: 'shell', permissionKey: 'edit', requiresConfirmation: true },
  execute: updateShellEnvironment,
};

export function registerEchoTools(): void {
  globalRegistry.register(echoUpdateShellEnv);
}
