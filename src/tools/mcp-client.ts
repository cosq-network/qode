// src/tools/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig } from '../config.js';

/**
 * Representation of a tool advertised by an MCP server.
 */
export interface MCPTool {
  /** Human‑readable name of the tool */
  name: string;
  /** Short description of what the tool does */
  description: string;
  /** JSON‑schema describing the expected input arguments. */
  inputSchema: Record<string, unknown>;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  /** List of tools discovered after a successful connection */
  tools: MCPTool[] = [];

  constructor(serverCommand: string, args: string[]) {
    this.transport = new StdioClientTransport({
      command: serverCommand,
      args,
    });
    this.client = new Client(
      { name: 'cosqcode', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  /** Connect to the MCP server and fetch the advertised tool list. */
  async connect(): Promise<MCPTool[]> {
    await this.client.connect(this.transport);
    const result = await this.client.listTools();
    const rawTools = (result as any)?.tools ?? [];
    // Preserve shape while providing proper typing.
    this.tools = rawTools.map((tool: any) => ({
      name: String(tool.name),
      description: typeof tool.description === 'string' ? tool.description : '',
      inputSchema: tool.inputSchema ?? {},
    }));
    return this.tools;
  }

  /** Invoke a tool on the remote server.
   *
   * @param name The tool name as advertised.
   * @param args Arguments respecting the tool's input schema.
   * @returns The tool's textual output or an error string.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.client.callTool({
      name,
      arguments: args,
    } as any);

    const rawContent = Array.isArray((result as any).content) ? (result as any).content : [];
    const parts = rawContent
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item && typeof (item as any).text === 'string') {
          return (item as any).text;
        }
        return JSON.stringify(item);
      })
      .filter((value: unknown): value is string => Boolean(value));

    if ((result as any).isError) {
      return `Error: ${parts.join('\\n')}`;
    }

    return parts.join('\\n') || 'Tool completed successfully.';
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function startMCPClients(servers: MCPServerConfig[]): Promise<MCPClient[]> {
  const clients: MCPClient[] = [];
  for (const server of servers) {
    const client = new MCPClient(server.command, server.args);
    await client.connect();
    clients.push(client);
  }
  return clients;
}