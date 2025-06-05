import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export type McpResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
};

/**
 * Base class for MCP server
 */
export abstract class BaseMCPServer {
  protected server: McpServer;

  constructor(name: string, version: string) {
    this.server = new McpServer({
      name,
      version
    });
    this.setupTools();
  }

  protected abstract setupTools(): void;

  /**
   * Execute API request and convert the result to MCP response format
   */
  protected async executeApiRequest(
    url: string,
    errorMessage: string
  ): Promise<McpResponse> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(rawData, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        content: [{
          type: "text",
          text: `${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  // Start the server
  async start(): Promise<void> {
    try {      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
            
      // Signal handler to keep the process running
      process.on('SIGINT', async () => {
        console.log('Received SIGINT signal');
        await this.server.close();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('Received SIGTERM signal');
        await this.server.close();
        process.exit(0);
      });

      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        this.server.close().then(() => process.exit(1));
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        this.server.close().then(() => process.exit(1));
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
} 