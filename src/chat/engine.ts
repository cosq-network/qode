import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { findModel } from '../providers/models.js';
import { OpenAICompatProvider } from '../providers/openai-compat.js';
import { GeminiProvider } from '../providers/gemini.js';
import { LLMProvider } from '../providers/base.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { executeToolCall } from '../tools/exec.js';
import { startMCPClients, MCPClient } from '../tools/mcp-client.js';
import type { ToolDefinition } from '../tools/definitions.js';
import type { CosqcodeConfig } from '../config.js';
export class MissingApiKeyError extends Error {
  constructor(public readonly provider: string) {
    super(`No API key configured for ${provider}. Run 'cosqcode auth' or set the appropriate environment variable.`);
    this.name = 'MissingApiKeyError';
  }
}

/**
 * ChatEngine encapsulates the runtime state needed for a chat session.
 * It owns:
 *   - MCP client connections (if any)
 *   - The merged tool list (built‑in + MCP tools)
 *   - Provider creation logic
 *   - Tool execution routing (MCP first, then built‑in exec)
 *
 * This makes the REPL loop (`loop.ts`) much simpler and enables easier unit‑testing.
 */
export class ChatEngine {
  /** Mapping of provider → default OpenAI‑compatible endpoint */
  private static readonly DEFAULT_BASE_URL: Record<string, string> = {
    'DeepSeek API': 'https://api.deepseek.com/v1',
    'OpenRouter': 'https://openrouter.ai/api/v1',
    'GroqCloud': 'https://api.groq.com/openai/v1',
    'GitHub Models': 'https://models.inference.ai.azure.com',
    default: 'https://api.openai.com/v1',
  };
  private mcpClients: MCPClient[] = [];
  private allTools: ToolDefinition[] = [];
  private config: CosqcodeConfig;

  constructor(config: CosqcodeConfig) {
    this.config = config;
  }

  /** Build the tool list, optionally starting MCP clients. */
  async rebuildAllTools(): Promise<void> {
    const builtIn = [...TOOL_DEFINITIONS];
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
    const found = findModel(modelName);
    if (!found) throw new Error(`Unknown model: ${modelName}`);
    const providerCfg = this.config.providers[found.providerKey];
    if (!providerCfg?.apiKey) {
      throw new MissingApiKeyError(found.providerKey);
    }
    if (found.providerKey === 'Google AI Studio') {
      return new GeminiProvider(found.model, providerCfg.apiKey);
    }
    const baseURL = providerCfg.baseURL ??
      (ChatEngine.DEFAULT_BASE_URL[found.providerKey] ?? ChatEngine.DEFAULT_BASE_URL.default);
    return new OpenAICompatProvider(found.providerKey, found.model, providerCfg.apiKey, baseURL);
  }

  /** Execute a tool – MCP tools are tried first, then fall back to built‑in exec. */
  async executeTool(toolName: string, toolArgs: Record<string, unknown>): Promise<string> {
    for (const client of this.mcpClients) {
      if (client.tools.some((t) => t.name === toolName)) {
        return await client.callTool(toolName, toolArgs);
      }
    }
    // built‑in tool dispatcher
    return await executeToolCall(toolName, toolArgs);
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
