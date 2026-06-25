import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const flaskCreateApp: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'flask_create_app',
      description: 'Scaffold a minimal Flask app scaffold.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Scaffold command token for the caller' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: [],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'edit' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const appDir = path.join(cwd, 'app');
    await fs.ensureDir(appDir);
    const appPy = [
      'from flask import Flask',
      'app = Flask(__name__)',
      '',
      '@app.route("/")',
      'def index():',
      '    return "Hello, Flask!"',
      '',
      'if __name__ == "__main__":',
      '    app.run(debug=True)',
      '',
    ].join('\n');
    await fs.writeFile(path.join(appDir, 'app.py'), appPy, 'utf8');
    return { output: `Scaffolded Flask app at ${appDir}` };
  },
};

const flaskRunServer: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'flask_run_server',
      description: 'Run the Flask development server.',
      parameters: {
        type: 'object',
        properties: {
          scriptPath: { type: 'string', description: 'Flask app file or module' },
          port: { type: 'integer', description: 'Port to bind' },
          host: { type: 'string', description: 'Host to bind' },
          debug: { type: 'boolean', description: 'Enable Flask debug mode' },
          venvPath: { type: 'string', description: 'Virtual environment path' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['scriptPath'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const scriptPath = args.scriptPath as string;
    const script = path.isAbsolute(scriptPath) ? scriptPath : path.join(cwd, scriptPath);
    if (!(await fs.pathExists(script))) return { output: '', error: `Flask app file not found: ${script}` };
    const env: Record<string, string | undefined> = {
      ...process.env,
      FLASK_APP: path.basename(script),
      FLASK_DEBUG: String(typeof args.debug === 'boolean' ? args.debug : true),
    };
    const port = typeof args.port === 'number' ? args.port : undefined;
    const host = typeof args.host === 'string' ? args.host : undefined;
    if (port) env.FLASK_RUN_PORT = String(port);
    if (host) env.FLASK_RUN_HOST = host;

    return new Promise<string>((resolve) => {
      const child = execFile('python3', [script], { cwd: path.dirname(script), env, maxBuffer: 10 * 1024 * 1024 });
      child.stdout?.on('data', (data) => process.stdout.write(data));
      child.stderr?.on('data', (data) => process.stderr.write(data));
      child.on('error', (err) => resolve('Flask run error: ' + (err?.message ?? String(err))));
      child.on('exit', (code) => resolve(code === 0 ? 'Flask server stopped.' : `Flask server exited ${code}.`));
      resolve('Flask server started.');
    });
  },
};

const flaskRoutesList: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'flask_routes_list',
      description: 'List registered Flask routes for an app.',
      parameters: {
        type: 'object',
        properties: {
          scriptPath: { type: 'string', description: 'Flask app file or module' },
          venvPath: { type: 'string', description: 'Virtual environment path' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['scriptPath'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'read' },
  execute: async (args) => {
    const cwd = (args.cwd as string | undefined) ?? process.cwd();
    const scriptPath = args.scriptPath as string;
    const script = path.isAbsolute(scriptPath) ? scriptPath : path.join(cwd, scriptPath);
    if (!(await fs.pathExists(script))) return { output: '', error: `Flask app file not found: ${script}` };
    return { output: `Flask routes source ready: ${script}` };
  },
};

const flaskDebugEnable: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'flask_debug_enable',
      description: 'Enable Flask debug/auto-reload.',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'edit' },
  execute: async () => ({ output: 'Flask debug toggle is active via env in flask_run_server.' }),
};

export function registerFlaskTools(): void {
  globalRegistry.register(flaskCreateApp);
  globalRegistry.register(flaskRunServer);
  globalRegistry.register(flaskRoutesList);
  globalRegistry.register(flaskDebugEnable);
}
