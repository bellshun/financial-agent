import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool情報をmain.ts 側でも扱いやすいように整形するための型
 */
export interface ToolMetadata {
  /** ツール名 */
  name: string;
  /** ツールの説明 */
  description?: string | undefined;
  /** JSON Schema */
  inputSchema: any;
  /** ツールが所属するサーバー名 ("crypto" | "news" | "stock") */
  server: string;
}

export class MCPClientManager {
  private mcpClients: Map<string, Client> = new Map();
  private mcpTransports: Map<string, StdioClientTransport> = new Map();
  private toolMetadata: ToolMetadata[] = [];

  constructor(
    private config: {
      mcpServers?: {
        crypto: { command: string; args: string[] };
        news: { command: string; args: string[] };
        stock: { command: string; args: string[] };
      };
    } = {}
  ) {
    // デフォルトで各サーバーを tsx で起動する想定。必要に応じて引数でオーバーライド可能。
    this.config.mcpServers = {
      crypto: { command: "tsx", args: ["./src/mcp/crypto-server.ts"] },
      news: { command: "tsx", args: ["./src/mcp/news-server.ts"] },
      stock: { command: "tsx", args: ["./src/mcp/stock-server.ts"] },
      ...config.mcpServers,
    };
  }

  /**
   * 各 MCP サーバーに接続し、listTools() で得られたツール情報を availableTools に格納する
   */
  async initialize(): Promise<void> {
    try {
      for (const [serverName, serverConfig] of Object.entries(this.config.mcpServers!)) {
        await this.connectToMCPServer(serverName, serverConfig);
      }
      console.log(
        `Connected to MCP servers: ${Array.from(this.mcpClients.keys()).join(", ")}`
      );
    } catch (error) {
      console.error("Failed to initialize MCP clients:", error);
      throw error;
    }
  }

  /**
   * 特定のサーバーに対して Stdio 経由で Client を構築し、
   * client.listTools() を呼んで availableTools に登録する
   */
  private async connectToMCPServer(
    serverName: string,
    config: { command: string; args: string[] }
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
    });

    const client = new Client(
      { name: serverName/*`${serverName}-client`*/, version: "1.0.0" },
      // capabilities は空で問題ありません。ツール検出は listTools() で行うためです。
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    // MCPサーバーのTool取得
    const toolsResult = (await client.listTools()) as ListToolsResult;
    toolsResult.tools?.forEach((tool) => {
      if (!tool.name || !tool.inputSchema) return;

      // Tool オブジェクト (name, description, inputSchema) を availableTools へ格納
      this.toolMetadata.push({ 
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        server: serverName,
      });
    });

    this.mcpClients.set(serverName, client);
    this.mcpTransports.set(serverName, transport);
  }

  getToolMetadata(): ToolMetadata[] {
    return this.toolMetadata;
  }

  /**
   * availableTools にキャッシュされているすべてのツールを
   * ToolMetadata 型の配列として返す
   */
  // async listTools(): Promise<ToolMetadata[]> {
  //   return Array.from(this.availableTools.entries()).map(([name, { tool, server }]) => ({
  //     name: tool.name,
  //     description: tool.description,
  //     inputSchema: tool.inputSchema,
  //     server,
  //   }));
  // }

  /**
   * 指定したサーバー(serverName) のツール(toolName) を
   * パラメータ(parameters) 付きで実行し、その結果を返す
   */
  async executeTool(
    serverName: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<CallToolResult> {
    const client = this.mcpClients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" not available`);
    }
    console.log(`ツール "${toolName}" を実行します (server: ${serverName})`);
    return (await client.callTool({
      name: toolName,
      arguments: parameters,
    })) as CallToolResult;
  }

  /**
   * すべてのサーバーとの接続をクローズし、内部キャッシュをクリア
   */
  async cleanup(): Promise<void> {
    try {
      for (const [, transport] of this.mcpTransports.entries()) {
        await transport.close();
      }
      this.mcpClients.clear();
      this.mcpTransports.clear();
      this.toolMetadata = []
      console.log("MCPClientManager: Cleanup completed");
    } catch (error) {
      console.error("MCPClientManager: Cleanup failed:", error);
    }
  }

  /**
   * 現在登録されているツール名の一覧を返す
   */
  // getAvailableTools(): string[] {
  //   return Array.from(this.availableTools.keys());
  // }
}
