import { FinancialNewsSchema, SearchNewsSchema } from "./schemas";
import 'dotenv/config';
import { BaseMCPServer } from "./base-mcp-server";

// APIキーの取得と検証
const NEWS_API_KEY = process.env.NEWS_API_KEY;
if (!NEWS_API_KEY) {
  console.error('Error: NEWS_API_KEY is not set in environment variables');
  process.exit(1);
}

export class NewsMCPServer extends BaseMCPServer  {
  constructor() {
    super("news-mcp-server", "1.0.0");
  }

  protected setupTools(): void {
    const baseUrl = 'https://newsapi.org/v2';

    // 金融ニュース取得ツール
    this.server.tool(
      "get_financial_news",
      "Search through millions of articles from over 150,000 large and small news sources and blogs with a stock ticker (security code)",
      FinancialNewsSchema.shape,
      async ({ symbols, limit = 10 }, extra) => {
        const query = symbols.join(' OR ');
        /**
         * 株式ティッカー(証券コード)を利用して、株価や証券に関するニュースを取得
         * https://newsapi.org/docs/endpoints/everything
         */
        const url = `${baseUrl}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
        return this.executeApiRequest(url, "Error fetching financial news");
      }
    );

    // 一般ニュース検索ツール
    this.server.tool(
      "search_news",
      "Search through millions of articles from over 150,000 large and small news sources and blogs with a keyword",
      SearchNewsSchema.shape,
      async ({ query, limit = 10, sortBy = "publishedAt" }, extra) => {
        /**
         * 検索キーワードを利用して、ニュース全般を取得する
         * https://newsapi.org/docs/endpoints/everything
         */
        const url = `${baseUrl}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=${sortBy}&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
        return this.executeApiRequest(url, "Error searching news");
      }
    );
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

export default NewsMCPServer;