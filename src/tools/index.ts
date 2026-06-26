import { registerFileTools } from './file/index.js';
import { registerShellTools } from './shell/index.js';
import { registerSearchTools } from './search/index.js';
import { registerGitTools } from './git/index.js';
import { registerBuildTools } from './build/index.js';
import { registerWebTools } from './web/index.js';
import { registerTodowriteTool } from './todowrite/index.js';
import { registerTaskTool } from './task/index.js';
import { registerRemoteTools } from './remote/index.js';
import { registerFlaskTools } from './flask/index.js';
import { registerSemanticSearchTool } from './semantic-search/index.js';
import { registerIonicTools } from './ionic/index.js';
import { registerMsBuildTools } from './msbuild/index.js';
import { registerNpxTools } from './npx/index.js';
import { registerQemuTools } from './qemu/index.js';
import { registerEchoTools } from './echo/index.js';

let initialized = false;

/** Initialize and register all built-in tools. Safe to call multiple times. */
export function initializeTools(): void {
  if (initialized) return;
  registerFileTools();
  registerShellTools();
  registerSearchTools();
  registerGitTools();
  registerBuildTools();
  registerWebTools();
  registerTodowriteTool();
  registerTaskTool();
  registerSemanticSearchTool();
  registerFlaskTools();
  registerRemoteTools();
  registerIonicTools();
  registerMsBuildTools();
  registerNpxTools();
  registerQemuTools();
  registerEchoTools();
  initialized = true;
}

export { globalRegistry } from './registry.js';
export type { ToolResult, ToolMetadata, RegisteredTool } from './registry.js';
