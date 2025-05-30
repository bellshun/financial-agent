import { MCPClient } from './mcp-client';
import chalk from 'chalk';

/**
 * 複数のクライアントを管理
 */
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private isShuttingDown = false;

  async getClient(serverName: string): Promise<MCPClient> {
    if (this.isShuttingDown) {
      throw new Error('Manager is shutting down');
    }

    if (this.clients.has(serverName)) {
      const existingClient = this.clients.get(serverName)!;
      
      // 既存クライアントの健全性をチェック
      try {
        await existingClient.listTools();
        return existingClient;
      } catch (error) {
        await this.disconnectClient(serverName);
      }
    }

    const client = new MCPClient(serverName);
    const connected = await client.connect();
    
    if (!connected) {
      throw new Error(`Failed to connect to ${serverName}`);
    }

    this.clients.set(serverName, client);
    return client;
  }

  async disconnectAll(): Promise<void> {
    this.isShuttingDown = true;
    console.log(chalk.yellow('🔄 Disconnecting all MCP clients...'));

    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(chalk.red(`❌ Error disconnecting ${name}:`), error);
        }
      }
    );
    
    await Promise.allSettled(disconnectPromises);
    this.clients.clear();
    console.log(chalk.green('🎉 All clients disconnected'));
  }

  async disconnectClient(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      try {
        await client.disconnect();
        this.clients.delete(serverName);
      } catch (error) {
        console.error(chalk.red(`❌ Error disconnecting ${serverName}:`), error);
        // エラーでも削除する（ゾンビクライアント回避）
        this.clients.delete(serverName);
      }
    }
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, client] of this.clients) {
      try {
        await client.listTools();
        health[name] = true;
        console.log(chalk.green(`✅ ${name}: healthy`));
      } catch (error) {
        health[name] = false;
        console.warn(chalk.yellow(`⚠️  ${name}: unhealthy`));
      }
    }
    
    return health;
  }

  // 利用可能なサーバー一覧を取得
  getAvailableServers(): string[] {
    return ['stock-mcp-server', 'crypto-mcp-server', 'news-mcp-server'];
  }

  // すべてのサーバーに一度に接続
  async connectAll(): Promise<void> {
    const servers = this.getAvailableServers();
    console.log(chalk.blue(`🚀 Connecting to all servers: ${servers.join(', ')}`));

    const connectionPromises = servers.map(async (serverName) => {
      try {
        await this.getClient(serverName);
        return { server: serverName, success: true };
      } catch (error) {
        console.error(chalk.red(`❌ Failed to connect to ${serverName}:`), error);
        return { server: serverName, success: false, error };
      }
    });

    const results = await Promise.allSettled(connectionPromises);
    
    const successful = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .length;
    
    console.log(chalk.green(`🎉 Connected to ${successful}/${servers.length} servers`));
  }
}

// シングルトンパターンでグローバルに使用
export const mcpManager = new MCPClientManager();

// プロセス終了時の cleanup
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down...'));
  await mcpManager.disconnectAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down...'));
  await mcpManager.disconnectAll();
  process.exit(0);
});