import { FinancialNewsSchema, SearchNewsSchema } from "./schemas";
import 'dotenv/config';
import { BaseMCPServer } from "./base-mcp-server";

// Get and validate API key
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

    this.server.tool(
      "get_financial_news",
      "Search through millions of articles from over 150,000 large and small news sources and blogs with a stock ticker (security code)",
      FinancialNewsSchema.shape,
      async ({ symbols, pageSize = 10 }) => {
        const query = symbols.join(' OR ');
        /**
         * Get news about stocks and securities using stock ticker (security code)
         * https://newsapi.org/docs/endpoints/everything
         */
        const url = `${baseUrl}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;
        return this.executeApiRequest(url, "Error fetching financial news");
      }
    );

    this.server.tool(
      "search_news",
      "Search through millions of articles from over 150,000 large and small news sources and blogs with a keyword",
      SearchNewsSchema.shape,
      async ({ query, pageSize = 10, sortBy = "publishedAt" }) => {
        /**
         * Get general news using search keywords
         * https://newsapi.org/docs/endpoints/everything
         */
        const url = `${baseUrl}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=${sortBy}&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;
        return this.executeApiRequest(url, "Error searching news");
      }
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new NewsMCPServer();
  server.start().catch(error => {
    console.error('Failed to start news server:', error);
    process.exit(1);
  });
}

export default NewsMCPServer;