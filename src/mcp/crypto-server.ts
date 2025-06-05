import { CryptoPriceSchema, MarketDataSchema, SymbolSearchSchema } from "./schemas";
import { BaseMCPServer } from "./base-mcp-server";

/**
 * MCP server that provides cryptocurrency data
 */
export class CryptoMCPServer extends BaseMCPServer {
  constructor() {
    super("crypto-mcp-server", "1.0.0");
  }

  protected setupTools(): void {
    const baseUrl = 'https://api.coingecko.com/api/v3';

    this.server.tool(
      "get_crypto_price",
      "This endpoint allows you to query the prices of one or more coins by using their unique Coin API IDs",
      CryptoPriceSchema.shape,
      async ({ symbol }) => {
        /**
         * Get cryptocurrency price information
         * https://docs.coingecko.com/v3.0.1/reference/simple-price
         */
        const url = `${baseUrl}/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`;
        return this.executeApiRequest(url, "Error fetching crypto price");
      }
    );

    this.server.tool(
      "get_market_data", 
      "This endpoint allows you to query all the metadata (image, websites, socials, description, contract address, etc.) and market data (price, ATH, exchange tickers, etc.) of a coin from the CoinGecko coin page based on a particular coin ID",
      MarketDataSchema.shape,
      async ({ symbol }) => {
        /**
         * Get more detailed cryptocurrency information
         * https://docs.coingecko.com/v3.0.1/reference/coins-id
         */
        const url = `${baseUrl}/coins/${symbol}`;
        return this.executeApiRequest(url, "Error fetching market data");
      }
    );

    this.server.tool(
      "search_symbol",
      "This endpoint allows you to query all the supported coins on CoinGecko with coins ID, name and symbol",
      SymbolSearchSchema.shape,
      async () => {
        /**
         * Get list of cryptocurrency symbols
         * https://docs.coingecko.com/v3.0.1/reference/coins-list
         */
        const url = `${baseUrl}/coins/list`;
        return this.executeApiRequest(url, "Error searching symbol");
      }
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CryptoMCPServer();
  server.start().catch(console.error);
}

export default CryptoMCPServer;