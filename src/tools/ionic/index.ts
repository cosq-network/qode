import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const ionicCreateApp: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'ionic_create_app',
      description: 'Create a new Ionic app with the Ionic CLI.',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App/project name' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
          framework: { type: 'string', enum: ['angular', 'react', 'vue'], description: 'Frontend framework' },
          type: { type: 'string', description: 'Ionic starter type: blank, tabs, sidemenu, etc.' },
        },
        required: ['appName'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const appName = args.appName as string;
    const framework = (args.framework as string | undefined) ?? 'react';
    const starterType = (args.type as string | undefined) ?? 'blank';
    if (!['angular', 'react', 'vue'].includes(framework)) {
      return { output: '', error: `Unsupported Ionic framework: ${framework}` };
    }
    const targetDir = path.join(cwd, appName);
    try {
      await fs.ensureDir(cwd);
      await new Promise<void>((resolve, reject) => {
        execFile(
          'ionic',
          ['start', appName, starterType, '--type', framework, '--no-git', '--no-interactive', '--confirm'],
          { cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve();
          },
        );
      });
      return { output: `Ionic app created: ${appName} (${framework} ${starterType}) at ${targetDir}` };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { output: '', error: message };
    }
  },
};

const ionicBuild: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'ionic_build',
      description: 'Build an Ionic app (web/capacitor build step).',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
          project: { type: 'string', description: 'Project/package name' },
        },
        required: [],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const project = typeof args.project === 'string' ? args.project : undefined;
    return runIonic(cwd, project, ['build']);
  },
};

const ionicCapacitorRun: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'ionic_capacitor_run',
      description: 'Run an Ionic/Capacitor app on a target platform.',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
          platform: { type: 'string', description: 'Platform: ios, android, web' },
          project: { type: 'string', description: 'Project/package name (optional)' },
        },
        required: ['platform'],
      } as any,
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const platform = args.platform as string;
    const project = typeof args.project === 'string' ? args.project : undefined;
    return runIonic(cwd, project, ['cap', 'run', platform]);
  },
};

async function runIonic(cwd: string, project: string | undefined, args: string[]): Promise<{ output: string; error?: string }> {
  const bin = 'ionic';
  try {
    const cmd = project ? [bin, ...args, '--project', project] : [bin, ...args];
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        cmd[0],
        cmd.slice(1),
        { cwd, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout.trim());
        },
      );
    });
    return { output: stdout || 'Command completed.' };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { output: '', error: message };
  }
}

export function registerIonicTools(): void {
  globalRegistry.register(ionicCreateApp);
  globalRegistry.register(ionicBuild);
  globalRegistry.register(ionicCapacitorRun);
}
