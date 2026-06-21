import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig } from '../config.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
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

  async connect(): Promise<MCPTool[]> {
    await this.client.connect(this.transport);
    const result = await this.client.listTools();
    const rawTools = (result as any)?.tools ?? [];
    this.tools = rawTools.map((tool: any) => ({
      name: String(tool.name),
      description: typeof tool.description === 'string' ? tool.description : '',
      inputSchema: tool.inputSchema ?? {},
    }));
    return this.tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<string> {
    const result = await this.client.callTool({
      name,
      arguments: args,
    } as any);

    const rawContent = Array.isArray((result as any).content) ? (result as any).content : [];
    const parts = rawContent
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text;
        }
        return JSON.stringify(item);
      })
      .filter((value: string | undefined): value is string => Boolean(value));

    if ((result as any).isError) {
      return `Error: ${parts.join('\n')}`;
    }

    return parts.join('\n') || 'Tool completed successfully.';
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