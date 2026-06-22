import { runShell } from '../helpers.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const shellExec: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'shell_exec',
      description: 'Execute a shell command and return its output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Full shell command to run' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
  },
  metadata: { category: 'shell', permissionKey: 'bash', requiresConfirmation: false },
  execute: async (args) => {
    const cmd = args.command as string;
    if (!cmd) return { output: '', error: 'No command provided.' };
    const output = await runShell(cmd, args.cwd as string | undefined);
    if (output.startsWith('Error:')) {
      return { output: '', error: output.slice(7) };
    }
    return { output };
  },
};

/** Register all shell tools. */
export function registerShellTools(): void {
  globalRegistry.register(shellExec);
}
