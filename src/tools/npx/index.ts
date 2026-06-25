import { execFile } from 'child_process';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const npxRun: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'npx_run',
      description: 'Run an npm package or script via npx.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command/package to run with npx' },
          args: { type: 'array', items: { type: 'string' }, description: 'Args forwarded to the command' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const command = args.command as string;
    const extraArgs = Array.isArray(args.args) ? args.args.filter((arg): arg is string => typeof arg === 'string') : [];
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    if (!command.trim()) return { output: '', error: 'command is required.' };
    try {
      const output = await new Promise<string>((resolve, reject) => {
        execFile('npx', [command.trim(), ...extraArgs], { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout.trim());
        });
      });
      return { output: output || 'NPX command completed.' };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

export function registerNpxTools(): void {
  globalRegistry.register(npxRun);
}
