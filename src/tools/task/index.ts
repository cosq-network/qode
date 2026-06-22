import { globalRegistry } from '../registry.js';
import { getSubagentManager } from '../../agents/subagent.js';
import type { RegisteredTool } from '../registry.js';

const taskTool: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'task',
      description: 'Delegate a task to a specialized subagent. The subagent runs in its own session with restricted permissions and returns a summary.',
      parameters: {
        type: 'object' as const,
        properties: {
          subagent: {
            type: 'string',
            enum: ['explore', 'general'],
            description: 'The subagent type to delegate to',
          },
          prompt: {
            type: 'string',
            description: 'The task description for the subagent to execute',
          },
        },
        required: ['subagent', 'prompt'],
      },
    },
  },
  metadata: {
    category: 'planning',
    permissionKey: 'read',
  },
  execute: async (args: Record<string, unknown>) => {
    const subagentName = args.subagent as string;
    const manager = getSubagentManager();

    // Validate subagent
    const config = manager.getSubagent(subagentName);
    if (!config) {
      return `Error: Unknown subagent "${subagentName}". Available: ${manager.listSubagents().join(', ')}`;
    }

    // This stub is only reached if the tool is executed directly via the registry
    // (e.g., in a subagent context). In normal flow, the engine intercepts this call.
    // The engine's executeSubagent() method handles the actual execution.
    return `Error: The task tool should be executed via the chat engine, not directly. Use the engine's executeTool() method to properly delegate to subagents.`;
  },
};

export function registerTaskTool(): void {
  globalRegistry.register(taskTool);
}
