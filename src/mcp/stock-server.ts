import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AlphaVantageQuoteResponseSchema, AlphaVantageTimeSeriesResponseSchema, StockQuoteSchema, TechnicalIndicatorsSchema } from "./schemas";
import dotenv from 'dotenv';

dotenv.config();
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

if (!ALPHA_VANTAGE_API_KEY) {
  console.error('Error: ALPHA_VANTAGE_API_KEY is not set in environment variables');
  process.exit(1);
}

/**
 * 株価データを提供するMCPサーバー
 */
export class StockMCPServer {
  private server: McpServer;

  constructor() {
    // MCPサーバーを作成
    this.server = new McpServer({
      name: "stock-mcp-server",
      version: "1.0.0"
    });

    this.setupTools();
  }

  private setupTools() {
    // 株価取得ツール
    this.server.tool(
      "get_stock_quote",
      StockQuoteSchema.shape,
      async ({ symbol }) => {
        console.log('Registered tool: get_stock_quote');
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
          }
          
          const rawData = await response.json();
          const data = AlphaVantageQuoteResponseSchema.parse(rawData);
          
          // APIエラーチェック
          if (data["Error Message"]) {
            throw new Error(`Alpha Vantage API Error: ${data["Error Message"]}`);
          }
          
          if (data["Note"]) {
            throw new Error(`Alpha Vantage API Limit: ${data["Note"]}`);
          }
          
          if (!data["Global Quote"]) {
            throw new Error(`No data found for symbol: ${symbol}`);
          }
          
          const quote = data["Global Quote"];
          const result = {
            symbol: quote["01. symbol"],
            price: parseFloat(quote["05. price"]),
            change: parseFloat(quote["09. change"]),
            changePercent: quote["10. change percent"],
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error('Error fetching stock quote:', error);
          
          return {
            content: [{
              type: "text",
              text: `Error fetching stock quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );

    // テクニカル指標計算ツール
    this.server.tool(
      "get_technical_indicators",
      TechnicalIndicatorsSchema.shape,
      async ({ symbol, period = "daily" }) => {
        console.log('Registered tool: get_technical_indicators');
        try {
          const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
          }
          
          const rawData = await response.json();
          const data = AlphaVantageTimeSeriesResponseSchema.parse(rawData);
          
          // APIエラーチェック
          if (data["Error Message"]) {
            throw new Error(`Alpha Vantage API Error: ${data["Error Message"]}`);
          }
          
          if (data["Note"]) {
            throw new Error(`Alpha Vantage API Limit: ${data["Note"]}`);
          }
          
          if (!data["Time Series (Daily)"]) {
            throw new Error(`No time series data found for symbol: ${symbol}`);
          }
          
          const timeSeries = data["Time Series (Daily)"];
          const dates = Object.keys(timeSeries).sort().reverse(); // 最新順にソート
          
          if (dates.length < 20) {
            throw new Error(`Insufficient data for technical analysis. Need at least 20 days, got ${dates.length}`);
          }
          
          // 過去20日間の終値を取得
          const prices = dates.slice(0, 20).map(date => parseFloat(timeSeries[date]["4. close"]));
          
          const sma20 = this.calculateSMA(prices);
          const rsi = this.calculateRSI(prices);
          
          const result = {
            symbol,
            period,
            sma20: Math.round(sma20 * 100) / 100, // 小数点以下2桁に丸める
            rsi: Math.round(rsi * 100) / 100,
            recommendation: this.getRecommendation(rsi),
            dataPoints: prices.length,
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error('Error calculating technical indicators:', error);
          
          return {
            content: [{
              type: "text",
              text: `Error calculating technical indicators for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
          };
        }
      }
    );
  }

  private calculateSMA(prices: number[]): number {
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  private calculateRSI(prices: number[]): number {
    if (prices.length < 2) return 50; // デフォルト値
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    // 価格変動を計算
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i-1] - prices[i]; // 古い価格 - 新しい価格（逆順のため）
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
    
    if (avgLoss === 0) return 100; // 損失がない場合
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private getRecommendation(rsi: number): string {
    if (rsi > 70) return 'SELL';
    if (rsi < 30) return 'BUY';
    return 'HOLD';
  }

  async start(): Promise<void> {
    try {
      console.log('Starting Stock MCP Server...');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.log('Stock MCP Server started successfully');
      
      // プロセスを維持するためのシグナルハンドラ
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

      // エラーハンドリング
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

// メインの実行部分
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new StockMCPServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// デフォルトエクスポート
export default StockMCPServer;