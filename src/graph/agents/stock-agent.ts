import { AgentState } from '../state';
import { StockAnalysis, StockData, TechnicalData } from '../types';
import { MCPClient } from '../../clients/mcp-client';
import { Logger } from '../../utils/logger';

export class StockAgent {
  private mcpClient: MCPClient;
  private logger: Logger;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.logger = new Logger('stock-agent');
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.symbols) {
      return {
        errors: [...(state.errors || []), 'No symbols provided for analysis'],
        agentStatus: {
          ...state.agentStatus,
          stock: 'failed'
        }
      };
    }

    this.logger.info('Stock agent starting analysis');
    
    try {
      const stockSymbols = this.filterStockSymbols(state.symbols);
      const analyses: Record<string, StockAnalysis> = {};
      
      for (const symbol of stockSymbols) {
        try {
          const data = await this.getStockData(symbol);
          const technicalData = await this.getTechnicalData(symbol);
          
          analyses[symbol] = {
            symbol,
            price: data.price,
            change24h: data.change,
            recommendation: technicalData.recommendation,
            confidence: this.calculateConfidence(technicalData),
            reasoning: this.generateReasoning(data, technicalData)
          };
          
          this.logger.info(`Analyzed ${symbol}: $${data.price} (${data.changePercent}%)`);
        } catch (error) {
          this.logger.error(`Failed to analyze ${symbol}:`, { error: String(error) });
        }
      }

      return {
        stockAnalysis: analyses,
        agentStatus: {
          ...state.agentStatus,
          stock: 'completed'
        }
      };

    } catch (error) {
      this.logger.error('Stock analysis failed:', { error: String(error) });
      return {
        errors: [...(state.errors || []), `Stock analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        agentStatus: {
          ...state.agentStatus,
          stock: 'failed'
        }
      };
    }
  }

  private filterStockSymbols(symbols: string[]): string[] {
    return symbols.filter(s => !s.toLowerCase().includes('bitcoin') && !s.toLowerCase().includes('ethereum'));
  }

  private async getStockData(symbol: string): Promise<StockData> {
    try {
      const response = await this.mcpClient.callTool({
        name: 'stock-server', 
        arguments: {
          symbol: symbol.toUpperCase()
        }
      });
      
      // レスポンスの構造を確認してデータを抽出
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          // JSON文字列をパース
          const stockData = JSON.parse(textContent.text) as StockData;
          // await endTrace(trace?.id, stockData);
          return stockData;
        }
      }
      
      throw new Error('Invalid response format from MCP server');
      
    } catch (error) {
      this.logger.warn(`Using mock data for ${symbol}`);
      return this.getMockStockData(symbol);
    }
  }

  private async getTechnicalData(symbol: string): Promise<TechnicalData> {
    try {
      const response = await this.mcpClient.callTool({
        name: 'stock-server', 
        arguments: {
          symbol: symbol.toUpperCase(),
          type: 'technical'
        }
      });

      // レスポンスの構造を確認してデータを抽出
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          // JSON文字列をパース
          const technicalData = JSON.parse(textContent.text) as TechnicalData;
          // await endTrace(trace?.id, technicalData);
          return technicalData;
        }
      }

      throw new Error('Invalid response format from MCP server');
    } catch (error) {
      this.logger.warn(`Using mock technical data for ${symbol}`);
      return this.getMockTechnicalData();
    }
  }

  private getMockStockData(symbol: string): StockData {
    const basePrice = 100 + Math.random() * 900;
    const change = (Math.random() - 0.5) * 10;
    
    return {
      price: basePrice,
      change: change,
      changePercent: (change / basePrice) * 100
    };
  }

  private getMockTechnicalData(): TechnicalData {
    return {
      sma20: 100 + Math.random() * 20,
      rsi: 30 + Math.random() * 40,
      recommendation: Math.random() > 0.5 ? 'buy' : 'sell'
    };
  }

  private calculateConfidence(technicalData: TechnicalData): number {
    // RSIとSMA20の位置関係から信頼度を計算
    const rsiConfidence = Math.abs(technicalData.rsi - 50) / 50; // 0-1の範囲に正規化
    const smaConfidence = Math.abs(technicalData.sma20 - 100) / 100; // 0-1の範囲に正規化
    
    return (rsiConfidence + smaConfidence) / 2;
  }

  private generateReasoning(data: StockData, technicalData: TechnicalData): string {
    const priceChange = data.changePercent > 0 ? 'up' : 'down';
    const rsiStatus = technicalData.rsi > 70 ? 'overbought' : technicalData.rsi < 30 ? 'oversold' : 'neutral';
    
    return `Price is ${priceChange} ${Math.abs(data.changePercent).toFixed(2)}% with RSI indicating ${rsiStatus} conditions.`;
  }
}