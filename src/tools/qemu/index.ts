import fs from 'fs-extra';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const QEMU_SYSTEM_BINARIES = new Set([
  'qemu-system-x86_64',
  'qemu-system-aarch64',
  'qemu-system-arm',
]);
const QEMU_NETWORK_BACKENDS = new Set(['user', 'none']);

function resolveQemuBinary(binary: string): string | null {
  const normalized = binary.trim();
  if (QEMU_SYSTEM_BINARIES.has(normalized)) return normalized;
  const base = path.basename(normalized);
  if (QEMU_SYSTEM_BINARIES.has(base)) return base;
  return null;
}

const qemuCreateVm: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'qemu_create_vm',
      description: 'Create a QEMU VM disk image.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'VM name' },
          target: { type: 'string', description: 'Disk image path' },
          size: { type: 'string', description: 'Disk size, e.g. 20G' },
          format: { type: 'string', enum: ['qcow2', 'raw', 'vdi', 'vhdx'], description: 'Image format' },
        },
        required: ['target'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'edit' },
  execute: async (args) => {
    const target = args.target as string;
    const resolved = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    const name = (args.name as string | undefined) ?? path.basename(resolved);
    const size = (args.size as string | undefined) ?? '20G';
    const format = (args.format as string | undefined) ?? 'qcow2';
    if (!['qcow2', 'raw', 'vdi', 'vhdx'].includes(format)) {
      return { output: '', error: `Unsupported disk format: ${format}` };
    }
    try {
      await fs.ensureDir(path.dirname(resolved));
      await new Promise<void>((resolve, reject) => {
        execFile(
          'qemu-img',
          ['create', '-f', format, resolved, size],
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve();
          },
        );
      });
      return { output: `Created QEMU disk ${resolved} (${name}, ${size}, ${format})` };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

const qemuRunVm: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'qemu_run_vm',
      description: 'Run a QEMU virtual machine.',
      parameters: {
        type: 'object',
        properties: {
          binary: { type: 'string', description: 'QEMU binary, e.g. qemu-system-x86_64' },
          target: { type: 'string', description: 'Disk image path' },
          iso: { type: 'string', description: 'Optional ISO path' },
          cpus: { type: 'integer', description: 'CPU count' },
          memory: { type: 'string', description: 'Memory, e.g. 2G' },
          network: { type: 'string', enum: ['user', 'none'], description: 'Network backend' },
          enableKvm: { type: 'boolean', description: 'Enable KVM/HVF/WHX acceleration' },
          waitForExit: { type: 'boolean', description: 'Wait until the VM exits before returning (default: false)' },
          timeoutMs: { type: 'integer', description: 'Timeout when waitForExit is true, in milliseconds' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['target'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const binary = resolveQemuBinary((args.binary as string | undefined) ?? 'qemu-system-x86_64');
    if (!binary) return { output: '', error: 'Unsupported or missing QEMU binary.' };
    const target = args.target as string;
    const resolvedTarget = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    if (!(await fs.pathExists(resolvedTarget))) {
      return { output: '', error: `Disk image not found: ${resolvedTarget}` };
    }
    const iso = args.iso as string | undefined;
    const resolvedIso = iso ? (path.isAbsolute(iso) ? iso : path.join(process.cwd(), iso)) : undefined;
    if (resolvedIso && !(await fs.pathExists(resolvedIso))) {
      return { output: '', error: `ISO not found: ${resolvedIso}` };
    }
    const cwd = (args.cwd as string | undefined) ?? path.dirname(resolvedTarget);
    const qemuArgs = [
      '-drive', `file=${resolvedTarget},if=virtio`,
      '-m', typeof args.memory === 'string' && args.memory ? args.memory : '2G',
      '-smp', typeof args.cpus === 'number' && args.cpus > 0 ? String(args.cpus) : '2',
    ];
    if (typeof args.enableKvm === 'boolean' && args.enableKvm) {
      qemuArgs.push('-enable-kvm');
    }
    const backend = typeof args.network === 'string' && args.network.trim() ? args.network.trim() : 'user';
    if (!QEMU_NETWORK_BACKENDS.has(backend)) {
      return { output: '', error: `Unsupported QEMU network backend: ${backend}` };
    }
    if (backend !== 'none') {
      qemuArgs.push('-netdev', `${backend},id=net0`, '-device', 'virtio-net-pci,netdev=net0');
    }
    if (resolvedIso) qemuArgs.push('-cdrom', resolvedIso);
    try {
      const waitForExit = typeof args.waitForExit === 'boolean' ? args.waitForExit : false;
      if (!waitForExit) {
        const child = spawn(binary, qemuArgs, {
          cwd,
          detached: true,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve, reject) => {
          child.once('spawn', resolve);
          child.once('error', (err) => reject(new Error(err?.message ?? String(err))));
        });
        child.unref();
        return { output: `QEMU VM started: ${binary} ${resolvedTarget} (pid ${child.pid})` };
      }

      const timeoutMs = typeof args.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : 120000;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(binary, qemuArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`QEMU timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.on('error', (err) => {
          clearTimeout(timer);
          reject(new Error(err?.message ?? String(err)));
        });
        child.on('exit', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`QEMU exited with code ${code}`));
        });
      });
      return { output: `QEMU VM exited: ${binary} ${resolvedTarget}` };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

const qemuSnapshot: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'qemu_snapshot',
      description: 'Manage QEMU VM snapshots.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Snapshot command: list, save, delete, load' },
          target: { type: 'string', description: 'Disk image path' },
          snapshotName: { type: 'string', description: 'Snapshot name for save/delete/load' },
        },
        required: ['command', 'target'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'edit' },
  execute: async (args) => {
    const command = args.command as string;
    const target = args.target as string;
    const resolvedTarget = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    if (!['list', 'save', 'delete', 'load'].includes(command)) {
      return { output: '', error: `Unsupported snapshot command: ${command}` };
    }
    if (!(await fs.pathExists(resolvedTarget))) {
      return { output: '', error: `Disk image not found: ${resolvedTarget}` };
    }
    const snapshotName = args.snapshotName as string | undefined;
    if (['save', 'delete', 'load'].includes(command) && !snapshotName) {
      return { output: '', error: 'snapshotName is required for save/delete/load' };
    }
    let qemuImgArgs: string[];
    if (command === 'list') qemuImgArgs = ['snapshot', '-l', resolvedTarget];
    else if (command === 'save') qemuImgArgs = ['snapshot', '-c', snapshotName!, resolvedTarget];
    else if (command === 'delete') qemuImgArgs = ['snapshot', '-d', snapshotName!, resolvedTarget];
    else qemuImgArgs = ['snapshot', '-a', snapshotName!, resolvedTarget];
    try {
      const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
        execFile('qemu-img', qemuImgArgs, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve({ stdout: stdout || '' });
        });
      });
      return { output: stdout.trim() || 'Snapshot command completed.' };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

const qemuListVms: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'qemu_list_vms',
      description: 'List known QEMU disk images in a directory.',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to scan for QEMU images' },
          extensions: { type: 'string', description: 'Comma-separated extensions, e.g. qcow2,raw' },
        },
        required: [],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'read' },
  execute: async (args) => {
    const searchDir = args.directory
      ? (path.isAbsolute(args.directory as string) ? (args.directory as string) : path.join(process.cwd(), args.directory as string))
      : process.cwd();
    const rawExts = typeof args.extensions === 'string' && args.extensions.trim() ? args.extensions.trim() : 'qcow2,raw,vdi';
    const extensions = new Set(rawExts.split(',').map((ext) => ext.trim()).filter(Boolean));
    try {
      const entries = await fs.readdir(searchDir);
      const matches = entries.filter((entry) => {
        const ext = path.extname(entry).slice(1).toLowerCase();
        return extensions.has(ext);
      });
      if (matches.length === 0) return { output: 'No QEMU images found.' };
      return { output: matches.join('\n') };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

export function registerQemuTools(): void {
  globalRegistry.register(qemuCreateVm);
  globalRegistry.register(qemuRunVm);
  globalRegistry.register(qemuSnapshot);
  globalRegistry.register(qemuListVms);
}
