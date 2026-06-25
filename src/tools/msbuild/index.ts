import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const msBuildRun: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'msbuild_run',
      description: 'Run MSBuild for a .NET project/solution.',
      parameters: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project/solution path' },
          configuration: { type: 'string', description: 'Build configuration: Debug/Release' },
          target: { type: 'string', description: 'Build target(s)' },
          additionalArgs: { type: 'array', items: { type: 'string' }, description: 'Extra MSBuild args' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['project'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const project = args.project as string;
    const resolved = path.isAbsolute(project) ? project : path.join(cwd, project);
    if (!(await fs.pathExists(resolved))) return { output: '', error: `Project not found: ${resolved}` };
    const configuration = typeof args.configuration === 'string' && args.configuration.trim() ? args.configuration.trim() : 'Debug';
    const buildArgs: string[] = [];
    if (typeof args.target === 'string' && args.target.trim()) {
      buildArgs.push('-target', args.target.trim());
    }
    buildArgs.push('-property:Configuration=' + configuration);
    if (Array.isArray(args.additionalArgs)) {
      for (const arg of args.additionalArgs) {
        if (typeof arg === 'string' && arg.trim()) buildArgs.push(arg);
      }
    }
    buildArgs.push(resolved);
    try {
      const output = await new Promise<string>((resolve, reject) => {
        execFile('msbuild', buildArgs, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout.trim());
        });
      });
      return { output: output || 'MSBuild completed.' };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

export function registerMsBuildTools(): void {
  globalRegistry.register(msBuildRun);
}
