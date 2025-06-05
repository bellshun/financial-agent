import { StockQuoteSchema, TechnicalIndicatorsSchema } from "./schemas";
import { BaseMCPServer } from "./base-mcp-server";
import 'dotenv/config';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
if (!ALPHA_VANTAGE_API_KEY) {
  console.error('Error: ALPHA_VANTAGE_API_KEY is not set in environment variables');
  process.exit(1);
}

/**
 * MCP server that provides stock price data
 */
export class StockMCPServer extends BaseMCPServer {
  constructor() {
    super("stock-mcp-server", "1.0.0");
  }

  protected setupTools(): void {
    const baseUrl = 'https://www.alphavantage.co/query';

    this.server.tool(
      "get_stock_quote",
      "This endpoint returns the latest price and volume information for a ticker of your choice. You can specify one ticker per API request.",
      StockQuoteSchema.shape,
      async ({ symbol }) => {
        console.log('Registered tool: get_stock_quote');
        /**
         * Get latest stock price information and previous day comparison
         * https://www.alphavantage.co/documentation/#latestprice
         */
        const url = `${baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        return this.executeApiRequest(url, `Error fetching stock quote for ${symbol}`);
      }
    );

    this.server.tool(
      "get_technical_indicators",
      "This API returns raw (as-traded) daily time series (date, daily open, daily high, daily low, daily close, daily volume) of the global equity specified, covering 20+ years of historical data. The OHLCV data is sometimes called candles in finance literature",
      TechnicalIndicatorsSchema.shape,
      async ({ symbol }) => {
        console.log('Registered tool: get_technical_indicators');
        /**
         * Get daily stock price information
         * https://www.alphavantage.co/documentation/#daily
         */
        const url = `${baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        return this.executeApiRequest(url, `Error fetching time series data for ${symbol}`);
      }
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new StockMCPServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default StockMCPServer;