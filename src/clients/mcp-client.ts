import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
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
    } catch (error) {
      console.error(chalk.red(`Error disconnecting from ${this.serverName}:`), error);
    }
  }

  // SDKのメソッドを直接呼び出す
  get listTools() { return this.client.listTools.bind(this.client); }
  get callTool() { return this.client.callTool.bind(this.client); }

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
