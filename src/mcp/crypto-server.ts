import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CoinGeckoMarketDataSchema, CoinGeckoPriceResponseSchema, CryptoPriceSchema, MarketDataSchema, SymbolSearchResponseSchema, SymbolSearchSchema } from "./schemas";

/**
 * 暗号通貨データを提供するMCPサーバー
 */
export class CryptoMCPServer {
  private server: McpServer;

  constructor() {
    // MCPサーバーを作成
    this.server = new McpServer({
      name: "crypto-mcp-server",
      version: "1.0.0"
    });

    this.setupTools();
  }

  private setupTools() {
    // 暗号通貨価格取得ツール
    this.server.tool(
      "get_crypto_price",
      CryptoPriceSchema.shape,
      async ({ symbol }) => {
        try {
          /**
           * 仮想通貨の価格情報を取得
           * https://docs.coingecko.com/v3.0.1/reference/simple-price
           */
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          }
          
          const rawData = await response.json();
          const data = CoinGeckoPriceResponseSchema.parse(rawData);
          
          if (!data[symbol]) {
            throw new Error(`Cryptocurrency '${symbol}' not found`);
          }
          
          const result = {
            symbol,
            price: data[symbol].usd,
            change24h: data[symbol].usd_24h_change || 0,
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error fetching crypto price: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );

    // マーケットデータ取得ツール
    this.server.tool(
      "get_market_data", 
      MarketDataSchema.shape,
      async ({ symbol }) => {
        try {
          /**
           * 仮想通貨のより詳細な情報を取得
           * https://docs.coingecko.com/v3.0.1/reference/coins-id
           */
          const url = `https://api.coingecko.com/api/v3/coins/${symbol}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          }
          
          const rawData = await response.json();
          const data = CoinGeckoMarketDataSchema.parse(rawData);
          
          const result = {
            symbol,
            currentPrice: data.market_data.current_price.usd,
            marketCap: data.market_data.market_cap.usd,
            volume24h: data.market_data.total_volume.usd,
            priceChange24h: data.market_data.price_change_percentage_24h,
            recommendation: this.getRecommendation(data.market_data.price_change_percentage_24h),
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error fetching market data: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );

    // シンボル検索ツール
    this.server.tool(
      "search_symbol",
      SymbolSearchSchema.shape,
      async ({ input }) => {
        try {
          const response = await fetch("https://api.coingecko.com/api/v3/coins/list");
          if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          }

          const rawData = await response.json();
          const data = SymbolSearchResponseSchema.parse(rawData);
          const lower = input.toLowerCase();

          const match = data.find(c => lower.includes(c.symbol.toLowerCase()));

          if (!match) {
            return {
              content: [{ type: "text", text: `No matching symbol found in input: '${input}'` }],
              isError: true
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ id: match.id, symbol: match.symbol, name: match.name }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error searching symbol: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );
  }

  private getRecommendation(change24h: number): string {
    if (change24h > 5) return 'BUY';
    if (change24h < -5) return 'SELL';
    return 'HOLD';
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// サーバーの起動（このファイルが直接実行される場合）
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CryptoMCPServer();
  server.start().catch(console.error);
}

export default CryptoMCPServer;