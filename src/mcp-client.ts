import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

export class MCPClientManager {
  private mcpClients: Map<string, Client> = new Map();
  private mcpTransports: Map<string, StdioClientTransport> = new Map();
  private availableTools: Map<string, { tool: any; server: string }> = new Map();

  constructor(
    private config: {
      mcpServers?: {
        crypto: { command: string; args: string[] };
        news: { command: string; args: string[] };
        stock: { command: string; args: string[] };
      };
    } = {}
  ) {
    this.config.mcpServers = {
      crypto: { command: 'tsx', args: ['./src/mcp/crypto-server.ts'] },
      news: { command: 'tsx', args: ['./src/mcp/news-server.ts'] },
      stock: { command: 'tsx', args: ['./src/mcp/stock-server.ts'] },
      ...config.mcpServers
    };
  }

  async initialize(): Promise<void> {
    try {
      for (const [serverName, serverConfig] of Object.entries(this.config.mcpServers!)) {
        await this.connectToMCPServer(serverName, serverConfig);
      }

      console.log(`Connected to MCP servers: ${Array.from(this.mcpClients.keys()).join(', ')}`);
      console.log('Available tools:');
      for (const [toolName, meta] of this.availableTools.entries()) {
        console.log(`- ${toolName} (server: ${meta.server})`);
      }
    } catch (error) {
      console.error('Failed to initialize MCP clients:', error);
      throw error;
    }
  }

  private async connectToMCPServer(
    serverName: string, 
    config: { command: string; args: string[] }
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args
    });

    const client = new Client(
      { name: `${serverName}-client`, version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    
    const toolsResult = await client.listTools() as ListToolsResult;
    toolsResult.tools?.forEach(tool => {
      this.availableTools.set(tool.name, { tool, server: serverName });
    });

    this.mcpClients.set(serverName, client);
    this.mcpTransports.set(serverName, transport);
  }

  async executeTool(
    serverName: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<CallToolResult> {
    const client = this.mcpClients.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not available`);
    }

    return await client.callTool({
      name: toolName,
      arguments: parameters
    }) as CallToolResult;
  }

  async cleanup(): Promise<void> {
    try {
      for (const [serverName, client] of this.mcpClients.entries()) {
        const transport = this.mcpTransports.get(serverName);
        if (transport) {
          await transport.close();
        }
      }
      this.mcpClients.clear();
      this.mcpTransports.clear();
      this.availableTools.clear();
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.availableTools.keys());
  }

  async healthCheck(): Promise<{
    mcpServers: Record<string, boolean>;
    tools: number;
  }> {
    const mcpHealth: Record<string, boolean> = {};
    for (const serverName of this.mcpClients.keys()) {
      try {
        const client = this.mcpClients.get(serverName);
        await client?.listTools();
        mcpHealth[serverName] = true;
      } catch {
        mcpHealth[serverName] = false;
      }
    }

    return {
      mcpServers: mcpHealth,
      tools: this.availableTools.size
    };
  }
} 