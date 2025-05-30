import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FinancialNewsSchema, NewsAPIResponseSchema, SearchNewsSchema } from "./schemas";
import dotenv from 'dotenv';

dotenv.config();

// APIキーの取得と検証
const NEWS_API_KEY = process.env.NEWS_API_KEY;
if (!NEWS_API_KEY) {
  console.error('Error: NEWS_API_KEY is not set in environment variables');
  process.exit(1);
}

export class NewsMCPServer {
  private server: McpServer;

  constructor() {
    // MCPサーバーを作成
    this.server = new McpServer({
      name: "news-mcp-server",
      version: "1.0.0"
    });

    this.setupTools();
  }

  private setupTools() {
    // 金融ニュース取得ツール
    this.server.tool(
      "get_financial_news",
      FinancialNewsSchema.shape,
      async ({ symbols, limit = 10 }) => {
        try {
          const query = symbols.join(' OR ');
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
          }

          const rawData = await response.json();
          const data = NewsAPIResponseSchema.parse(rawData);
          
          if (data.status === 'error') {
            throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
          }

          if (!data.articles || data.articles.length === 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  message: "No articles found for the specified symbols",
                  symbols,
                  articles: []
                }, null, 2)
              }]
            };
          }
          
          const result = {
            symbols,
            totalResults: data.totalResults || 0,
            articles: data.articles.map(article => ({
              title: article.title,
              description: article.description || "No description available",
              url: article.url,
              publishedAt: article.publishedAt,
              source: article.source.name
            })),
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error('Error fetching news:', error);
          
          return {
            content: [{
              type: "text",
              text: `Error fetching financial news: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );

    // 一般ニュース検索ツール（追加機能）
    this.server.tool(
      "search_news",
      SearchNewsSchema.shape,
      async ({ query, limit = 10, sortBy = "publishedAt" }) => {
        try {
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=${sortBy}&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
          }

          const rawData = await response.json();
          const data = NewsAPIResponseSchema.parse(rawData);
          
          if (data.status === 'error') {
            throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
          }

          if (!data.articles || data.articles.length === 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  message: "No articles found for the search query",
                  query,
                  articles: []
                }, null, 2)
              }]
            };
          }
          
          const result = {
            query,
            sortBy,
            totalResults: data.totalResults || 0,
            articles: data.articles.map(article => ({
              title: article.title,
              description: article.description || "No description available",
              url: article.url,
              publishedAt: article.publishedAt,
              source: article.source.name
            })),
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error('Error searching news:', error);
          
          return {
            content: [{
              type: "text",
              text: `Error searching news: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// サーバーの起動（このファイルが直接実行される場合）
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new NewsMCPServer();
  server.start().catch(error => {
    console.error('Failed to start news server:', error);
    process.exit(1);
  });
}

// デフォルトエクスポート
export default NewsMCPServer;