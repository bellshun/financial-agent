import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import chalk from 'chalk';

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private serverName: string;

  constructor(serverName: string) {
    this.serverName = serverName;
    this.client = new Client({
      name: `${serverName}-client`,
      version: "1.0.0"
    });
  }

  async connect(): Promise<boolean> {
    try {
      const serverScript = this.getServerScript();
      
      // studio経由でMCPサーバーに接続する
      this.transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverScript],
        stderr: 'inherit'
      });
      await this.client.connect(this.transport);
      
      console.log(chalk.green(`✅ Connected to ${this.serverName}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to connect to ${this.serverName}:`), error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.transport) {
        await this.transport.close();
      }
      console.log(chalk.gray(`Disconnected from ${this.serverName}`));
    } catch (error) {
      console.error(chalk.red(`Error disconnecting from ${this.serverName}:`), error);
    }
  }

  async listTools(): Promise<Tool[]> {
    try {
      const result = await this.client.listTools();
      console.log(result);
      return (result as any).tools || [];
    } catch (error) {
      console.error(chalk.red(`Error listing tools from ${this.serverName}:`), error);
      return [];
    }
  }

  async callTool(name: string, arguments_: Record<string, any>): Promise<CallToolResult> {
    try {
      const result = await this.client.request(
        {
          method: "tools/call",
          params: {
            name,
            arguments: arguments_
          }
        },
        CallToolRequestSchema
      );

      return result as unknown as CallToolResult;
      
    } catch (error) {
      console.error(chalk.red(`Error calling tool ${name} from ${this.serverName}:`), error);
      throw error;
    }
  }

  // リソースの一覧取得
  async listResources() {
    try {
      return await this.client.listResources();
    } catch (error) {
      console.error(chalk.red(`Error listing resources from ${this.serverName}:`), error);
      return { resources: [] };
    }
  }

  // リソースの読み取り
  async readResource(uri: string) {
    try {
      return await this.client.readResource({ uri });
    } catch (error) {
      console.error(chalk.red(`Error reading resource ${uri} from ${this.serverName}:`), error);
      throw error;
    }
  }

  // プロンプトの一覧取得
  async listPrompts() {
    try {
      return await this.client.listPrompts();
    } catch (error) {
      console.error(chalk.red(`Error listing prompts from ${this.serverName}:`), error);
      return { prompts: [] };
    }
  }

  // プロンプトの取得
  async getPrompt(name: string, arguments_?: Record<string, any>) {
    try {
      return await this.client.getPrompt({
        name,
        arguments: arguments_
      });
    } catch (error) {
      console.error(chalk.red(`Error getting prompt ${name} from ${this.serverName}:`), error);
      throw error;
    }
  }

  private getServerScript(): string {
    const serverScripts: Record<string, string> = {
      'stock-mcp-server': 'src/mcp/stock-server.ts',
      'crypto-mcp-server': 'src/mcp/crypto-server.ts',
      'news-mcp-server': 'src/mcp/news-server.ts'
    };

    const script = serverScripts[this.serverName];
    if (!script) {
      throw new Error(`Unknown server: ${this.serverName}`);
    }

    return script;
  }
}
