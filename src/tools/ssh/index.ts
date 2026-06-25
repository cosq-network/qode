import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getCwd } from '../helpers.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const execFileAsync = promisify(execFile);

function sshConnectivityCheck(
  destination: string,
  extraArgs: string[] | undefined
): Promise<boolean> {
  const sshArgs = [
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'ConnectTimeout=8',
    ...(Array.isArray(extraArgs) ? extraArgs : []),
    destination,
    'true',
  ];
  return execFileAsync('ssh', sshArgs, { maxBuffer: 1024 * 1024 })
    .then(() => true)
    .catch(() => false);
}

async function shortestExistingKnownHostsPath(): Promise<string | undefined> {
  const candidates = [
    path.join(os.homedir(), '.ssh', 'KNOWN_HOSTS'),
    path.join(os.homedir(), '.ssh', 'known_hosts'),
    path.join(os.homedir(), '.ssh', 'known_hosts.d'),
  ];
  for (const candidate of candidates) {
    const exists = await fs.pathExists(candidate);
    if (exists) return candidate;
  }
  await fs.ensureDir(path.join(os.homedir(), '.ssh'));
  const defaultPath = path.join(os.homedir(), '.ssh', 'known_hosts');
  await fs.writeFile(defaultPath, '', 'utf8');
  return defaultPath;
}

const sshCommand: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'ssh_command',
      description: 'Run an SSH command on a remote host (interactive shells are not supported).',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'Remote target, e.g. user@host or /path/to/jump.host',
          },
          command: { type: 'string', description: 'Remote command to execute' },
          pty: {
            type: 'boolean',
            description: 'Request a pseudo-tty when possible (default: false)',
          },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Extra flags appended after ssh (e.g. ["-p", "2222"])',
          },
          timeoutMs: {
            type: 'integer',
            description: 'Command timeout in milliseconds (default: 120000)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['destination', 'command'],
      },
    },
  },
  metadata: { category: 'remote', permissionKey: 'bash' },
  execute: async (args) => {
    const { destination, command, pty, extraArgs, timeoutMs, cwd } = args;
    if (!destination) return { output: '', error: 'destination is required for ssh_command.' };
    if (!command) return { output: '', error: 'command is required for ssh_command.' };

    const tty = typeof pty === 'boolean' ? pty : false;
    const timeout = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : 120000;
    const normalizedExtraArgs: string[] = Array.isArray(extraArgs) ? extraArgs : [];
    const sshBaseArgs: string[] = [];
    if (tty) sshBaseArgs.push('-t');

    const sshCmd = ['ssh', ...sshBaseArgs, ...normalizedExtraArgs, destination as string, command as string].join(' ');

    return new Promise<string>((resolve) => {
      const start = Date.now();
      exec(
        sshCmd,
        { cwd: (cwd as string | undefined) || getCwd(), maxBuffer: 10 * 1024 * 1024, timeout },
        (err, stdout, stderr) => {
          resolve(
            err
              ? `SSH command failed: ${stderr || err.message}\nSTDOUT:\n${stdout}`
              : stdout || stderr || 'SSH command completed with no output.'
          );
        }
      );
    });
  },
};

const scpCommand: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'scp_command',
      description: 'Copy files or directories over SSH using SCP.',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Remote or local source path (e.g. /etc/hosts or user@host:/etc/hosts)',
          },
          destination: {
            type: 'string',
            description: 'Remote or local destination path',
          },
          recursive: {
            type: 'boolean',
            description: 'Recursive copy for directories (default: false)',
          },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Extra flags appended after the scp command (e.g. ["-P", "2222"])',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  metadata: { category: 'remote', permissionKey: 'bash' },
  execute: async (args) => {
    const { source, destination, recursive, extraArgs, cwd } = args;
    if (!source) return { output: '', error: 'source is required for scp_command.' };
    if (!destination) return { output: '', error: 'destination is required for scp_command.' };

    const normalizedExtraArgs: string[] = Array.isArray(extraArgs) ? extraArgs : [];
    const argsList: string[] = [];
    if (recursive) argsList.push('-r');
    argsList.push(...normalizedExtraArgs);
    argsList.push(source as string, destination as string);

    return new Promise<string>((resolve) => {
      exec(
        `scp ${argsList.map((arg) => `"${arg.replace(/(["\\$])/g, '\\$1')}"`).join(' ')}`,
        { cwd: (cwd as string | undefined) || getCwd(), maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          resolve(
            err
              ? `SCP copy failed: ${stderr || err.message}\nSTDOUT:\n${stdout}`
              : stdout || stderr || 'SCP copy completed with no output.'
          );
        }
      );
    });
  },
};

const sshKnownHosts: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'ssh_known_hosts',
      description: 'Inspect or edit SSH known_hosts entries by path or hostname.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'search', 'remove'],
            description: 'Inspect or edit a known_hosts file',
          },
          path: {
            type: 'string',
            description: 'Explicit known_hosts path (default: looked up in ~/.ssh/known_hosts)',
          },
          host: {
            type: 'string',
            description: 'Host or host:port pattern to search or remove (required for search/remove)',
          },
        },
        required: ['action'],
      },
    },
  } as any,
  metadata: { category: 'remote', permissionKey: 'read' },
  execute: async (args) => {
    const { action, path: explicitPath, host } = args;
    const knownHostsPath = explicitPath ? String(explicitPath) : await shortestExistingKnownHostsPath();
    if (!knownHostsPath) return { output: '', error: 'No known_hosts path available.' };

    const exists = await fs.pathExists(knownHostsPath);
    if (!exists) return { output: '', error: `known_hosts file not found at ${knownHostsPath}` };

    if (action === 'list') {
      const content = await fs.readFile(knownHostsPath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      return { output: lines.length ? lines.join('\n') : 'No known_hosts entries found.' };
    }

    if (!host) return { output: '', error: 'host is required for search/remove.' };

    const content = await fs.readFile(knownHostsPath, 'utf8');
    const hostPattern = String(host);
    const match = (line: string) => line.split(/\s+/)[0]?.includes(hostPattern);

    if (action === 'search') {
      const hits = content.split('\n').filter((line) => match(line));
      return { output: hits.length ? hits.join('\n') : `No hosts matched "${hostPattern}".` };
    }

    if (action === 'remove') {
      const filtered = content.split('\n').filter((line) => !match(line) || line.trim().length === 0);
      const updated = filtered.join('\n');
      await fs.writeFile(knownHostsPath, updated, 'utf8');
      return { output: `Removed matching known_hosts entries for "${hostPattern}".` };
    }

    return { output: '', error: `Unsupported ssh_known_hosts action: ${action}` };
  },
};

export function registerRemoteTools(): void {
  globalRegistry.register(sshCommand);
  globalRegistry.register(scpCommand);
  globalRegistry.register(sshKnownHosts);
}
