import { CryptoPriceSchema, MarketDataSchema, SymbolSearchSchema } from "./schemas";
import { BaseMCPServer } from "./base-mcp-server";

/**
 * 暗号通貨データを提供するMCPサーバー
 */
export class CryptoMCPServer extends BaseMCPServer {
  constructor() {
    super("crypto-mcp-server", "1.0.0");
  }

  protected setupTools(): void {
    const baseUrl = 'https://api.coingecko.com/api/v3';

    // 暗号通貨価格取得ツール
    this.server.tool(
      "get_crypto_price",
      "This endpoint allows you to query the prices of one or more coins by using their unique Coin API IDs",
      CryptoPriceSchema.shape,
      async ({ symbol }) => {
        /**
         * 仮想通貨の価格情報を取得
         * https://docs.coingecko.com/v3.0.1/reference/simple-price
         */
        const url = `${baseUrl}/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`;
        return this.executeApiRequest(url, "Error fetching crypto price");
      }
    );

    // マーケットデータ取得ツール
    this.server.tool(
      "get_market_data", 
      "This endpoint allows you to query all the metadata (image, websites, socials, description, contract address, etc.) and market data (price, ATH, exchange tickers, etc.) of a coin from the CoinGecko coin page based on a particular coin ID",
      MarketDataSchema.shape,
      async ({ symbol }) => {
        /**
         * 仮想通貨のより詳細な情報を取得
         * https://docs.coingecko.com/v3.0.1/reference/coins-id
         */
        const url = `${baseUrl}/coins/${symbol}`;
        return this.executeApiRequest(url, "Error fetching market data");
      }
    );

    // シンボル検索ツール
    this.server.tool(
      "search_symbol",
      "This endpoint allows you to query all the supported coins on CoinGecko with coins ID, name and symbol",
      SymbolSearchSchema.shape,
      async () => {
        /**
         * 仮想通貨のシンボル一覧を取得
         * https://docs.coingecko.com/v3.0.1/reference/coins-list
         */
        const url = `${baseUrl}/coins/list`;
        return this.executeApiRequest(url, "Error searching symbol");
      }
    );
  }
}

// サーバーの起動
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CryptoMCPServer();
  server.start().catch(console.error);
}

export default CryptoMCPServer;