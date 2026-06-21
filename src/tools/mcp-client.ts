import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

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
    this.client = new Client({ name: 'cosqcode', version: '1.0.0' }, {
      capabilities: { tools: {} },
    });
  }

  async connect() {
    await this.client.connect(this.transport);
    const result = await this.client.listTools();
    this.tools = result.tools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema,
    }));
    return this.tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      return `Error: ${result.content.map(c => c.text).join('\n')}`;
    }
    return result.content.map(c => c.text).join('\n');
  }

  async close() {
    await this.client.close();
  }
}