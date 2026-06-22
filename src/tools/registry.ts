import type { ToolDefinition } from './definitions.js';

/**
 * Structured result from tool execution.
 * Tools can return either a plain string (backwards compatible) or a ToolResult.
 */
export interface ToolResult {
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
  truncated?: boolean;
}

/**
 * Metadata for a registered tool, used for permissions, categorization, and UI.
 */
export interface ToolMetadata {
  category: string;
  permissionKey: string;
  requiresConfirmation?: boolean;
}

/**
 * A registered tool with its definition, execution function, and metadata.
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<ToolResult | string>;
  metadata: ToolMetadata;
}

/**
 * Dynamic tool registry that replaces the monolithic switch statement.
 * Tools register themselves here, and the engine dispatches through the registry.
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  /** Register a tool. Overwrites if the tool name already exists. */
  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.function.name, tool);
  }

  /** Get a registered tool by name. */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** Check if a tool is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get all registered tool definitions (for LLM function calling). */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** Get all registered tool names. */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Get tools filtered by category. */
  getByCategory(category: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.metadata.category === category
    );
  }

  /** Get the permission key for a tool. */
  getPermissionKey(name: string): string | undefined {
    return this.tools.get(name)?.metadata.permissionKey;
  }

  /** Execute a tool by name, normalizing the result to a string. */
  async execute(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Unknown tool: ${name}`;
    }
    const result = await tool.execute(args);
    if (typeof result === 'string') {
      return result;
    }
    if (result.error) {
      return `Error: ${result.error}`;
    }
    return result.output;
  }

  /** Execute a tool and return the full ToolResult (for structured handling). */
  async executeRaw(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: '', error: `Unknown tool: ${name}` };
    }
    const result = await tool.execute(args);
    if (typeof result === 'string') {
      return { output: result };
    }
    return result;
  }
}

/** Global tool registry instance. */
export const globalRegistry = new ToolRegistry();
