import { logger } from '../utils/logger.js';
import { findModel } from '../providers/models.js';
import { OpenAICompatProvider } from '../providers/openai-compat.js';
import { GeminiProvider } from '../providers/gemini.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { OpenCodeProvider } from '../providers/opencode.js';
import { LocalModelProvider } from '../providers/local.js';
import { LLMProvider } from '../providers/base.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { executeToolCall } from '../tools/exec.js';
import { startMCPClients, MCPClient } from '../tools/mcp-client.js';
import { initializeTools, globalRegistry } from '../tools/index.js';
import { PermissionManager } from '../permissions/manager.js';
import { BUILTIN_MODELS, isModelDownloaded } from '../models/downloader.js';
import { getSubagentManager } from '../agents/subagent.js';
import { getAuthManager } from '../auth/manager.js';
import type { ToolDefinition } from '../tools/definitions.js';
import type { QodeConfig } from '../config.js';
import type { LLMMessage, ChatResponse } from '../providers/base.js';

export class MissingApiKeyError extends Error {
  constructor(public readonly provider: string) {
    super(`No API key configured for ${provider}. Run 'qode auth' or set the appropriate environment variable.`);
    this.name = 'MissingApiKeyError';
  }
}

/**
 * ChatEngine encapsulates the runtime state needed for a chat session.
 * It owns:
 *   - MCP client connections (if any)
 *   - The merged tool list (built-in registry + MCP tools)
 *   - Provider creation logic
 *   - Tool execution routing (MCP first, then registry, then legacy fallback)
 *   - Permission enforcement
 *
 * This makes the REPL loop (`loop.ts`) much simpler and enables easier unit-testing.
 */
export class ChatEngine {
  private mcpClients: MCPClient[] = [];
  private allTools: ToolDefinition[] = [];
  private config: QodeConfig;
  private permissionManager: PermissionManager;

  constructor(config: QodeConfig) {
    this.config = config;
    this.permissionManager = new PermissionManager(config.permissions);
    // Initialize the tool registry on first construction
    initializeTools();
  }

  /** Build the tool list, optionally starting MCP clients. */
  async rebuildAllTools(): Promise<void> {
    // Collect tool definitions from the registry
    const registryDefs = globalRegistry.getDefinitions();
    // Also include any legacy definitions not yet in the registry
    const registryNames = new Set(registryDefs.map((d) => d.function.name));
    const legacyDefs = TOOL_DEFINITIONS.filter(
      (d) => !registryNames.has(d.function.name)
    );
    const builtIn = [...registryDefs, ...legacyDefs];

    const mcpTools: ToolDefinition[] = [];
    if (this.config.mcpServers?.length) {
      this.mcpClients = await startMCPClients(this.config.mcpServers);
      for (const client of this.mcpClients) {
        for (const tool of client.tools) {
          mcpTools.push({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              // The MCP server supplies a JSON schema; we trust its shape at runtime.
      parameters: tool.inputSchema as any,
            },
          });
        }
      }
      if (mcpTools.length) logger.info(`Loaded ${mcpTools.length} MCP tools.`);
    }
    this.allTools = [...builtIn, ...mcpTools];
  }

  /** Create a provider instance for a given model name. */
  async createProvider(modelName: string): Promise<LLMProvider> {
    // Check for local model
    if (modelName === 'local' || modelName.toLowerCase().includes('local')) {
      const localCfg = this.config.localModel;
      if (localCfg?.enabled) {
        const filename = localCfg.modelPath ?? BUILTIN_MODELS[0].filename;
        if (await isModelDownloaded(filename)) {
          return new LocalModelProvider(
            `local-${filename.replace('.gguf', '')}`,
            filename,
            { port: localCfg.port, contextSize: localCfg.contextSize, threads: localCfg.threads, gpuLayers: localCfg.gpuLayers },
          );
        }
        throw new Error(`Local model not found: ${filename}. Run 'qode models' to download.`);
      }
      throw new Error('Local model support is not enabled. Set localModel.enabled in config.');
    }

    const found = findModel(modelName);
    if (!found) throw new Error(`Unknown model: ${modelName}`);

    // Check for API key - first from config, then from auth storage
    let apiKey = this.config.providers[found.providerKey]?.apiKey;
    if (!apiKey) {
      const authManager = getAuthManager();
      apiKey = await authManager.getApiKey(found.providerKey) ?? undefined;
    }
    if (!apiKey) {
      throw new MissingApiKeyError(found.providerKey);
    }

    if (found.runtime === 'gemini') {
      return new GeminiProvider(found.model, apiKey);
    }

    if (found.runtime === 'anthropic') {
      return new AnthropicProvider(found.model, 200_000, apiKey);
    }

    if (found.runtime === 'opencode') {
      return new OpenCodeProvider(found.model, apiKey);
    }

    const baseURL = this.config.providers[found.providerKey]?.baseURL ?? found.baseURL;
    if (!baseURL) {
      throw new Error(`No base URL configured for provider ${found.providerKey}.`);
    }
    return new OpenAICompatProvider(found.providerKey, found.model, apiKey, baseURL);
  }

  /** Execute a tool – checks permissions first, then tries MCP, registry, then legacy fallback. */
  async executeTool(toolName: string, toolArgs: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled.');
    }
    // 0. Check permissions
    const decision = await this.permissionManager.checkPermission(toolName, toolArgs);
    if (decision === 'deny') {
      return `Permission denied for tool "${toolName}". Use /permissions to adjust rules.`;
    }

    // Special handling for task tool (subagent delegation)
    if (toolName === 'task') {
      return this.executeSubagent(toolArgs, signal);
    }

    // 1. Try MCP tools
    for (const client of this.mcpClients) {
      if (client.tools.some((t) => t.name === toolName)) {
        return await client.callTool(toolName, toolArgs);
      }
    }
    // 2. Try the tool registry
    if (globalRegistry.has(toolName)) {
      return await globalRegistry.execute(toolName, toolArgs);
    }
    // 3. Legacy fallback — monolithic switch in exec.ts
    return await executeToolCall(toolName, toolArgs, signal);
  }

  /** Execute a subagent task. */
  private async executeSubagent(toolArgs: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled.');
    }
    const subagentName = toolArgs.subagent as string;
    const prompt = toolArgs.prompt as string;
    const manager = getSubagentManager();

    // Get subagent config
    const config = manager.getSubagent(subagentName);
    if (!config) {
      return `Error: Unknown subagent "${subagentName}". Available: ${manager.listSubagents().join(', ')}`;
    }

    // Create child session
    const child = manager.createChildSession(subagentName, prompt, 0);
    if (!child) {
      return `Error: Could not create subagent session (depth limit or unknown subagent).`;
    }

    try {
      // Create a sub-agent provider with the subagent's system prompt
      const subProvider = await this.createProvider(this.config.defaultModel || 'Gemini 2.5 Flash');

      // Build the subagent's message history
      const subMessages: LLMMessage[] = [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: prompt },
      ];

      // Filter tools based on subagent permissions
      const subTools = this.allTools.filter((t) => {
        const toolName = t.function.name;
        const perm = config.permissions[toolName] ?? config.permissions['*'];
        return perm === 'allow';
      });

      // Run the subagent (up to maxSteps iterations)
      let response: ChatResponse;
      let iterations = 0;
      const maxSteps = config.maxSteps ?? 30;

      do {
        if (signal?.aborted) {
          throw new Error('Operation cancelled.');
        }
        response = await subProvider.chat(subMessages, subTools, undefined, signal);
        subMessages.push(response.message);

        // If there are tool calls, execute them
        if (response.message.tool_calls && response.message.tool_calls.length > 0) {
          iterations++;
          if (iterations >= maxSteps) {
            logger.warn(`Subagent "${subagentName}" reached max steps (${maxSteps})`);
            break;
          }

          // Execute tool calls
          for (const toolCall of response.message.tool_calls) {
            if (signal?.aborted) {
              throw new Error('Operation cancelled.');
            }
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(toolCall.function.arguments || '{}');
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              args = {};
              subMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: Invalid tool arguments JSON: ${message}`,
              });
              continue;
            }
            const result = await this.executeTool(toolCall.function.name, args, signal);

            subMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        }
      } while (response.message.tool_calls && response.message.tool_calls.length > 0);

      // Get the final result
      const result = response.message.content ?? 'No output from subagent.';
      manager.completeChildSession(child.id, result);
      return result;
    } catch (error: any) {
      manager.failChildSession(child.id, error.message);
      return `Subagent error: ${error.message}`;
    }
  }

  /** Get the permission manager for direct access (e.g. slash commands). */
  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  /** Get the maximum number of tool calls allowed per turn. */
  getMaxToolCalls(): number | undefined {
    return this.config.maxToolCalls;
  }

  /** Get the config. */
  getConfig(): QodeConfig {
    return this.config;
  }

  /** Get the merged tool list for LLM calls. */
  getTools(): ToolDefinition[] {
    return this.allTools;
  }

  /** Gracefully close all MCP clients. */
  async close(): Promise<void> {
    for (const client of this.mcpClients) {
      await client.close();
    }
  }
}
