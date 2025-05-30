import { BaseAgent } from './base-agent';
import { AgentState } from '../state';
import { CryptoData, CryptoAnalysis } from '../types';
import { MCPClient } from '../../clients/mcp-client';
import { Logger } from '../../utils/logger';
// import { startTrace, endTrace } from '../../utils/tracing';

export class CryptoAgent extends BaseAgent {
  private mcpClient: MCPClient;
  protected override logger: Logger;

  constructor(mcpClient: MCPClient) {
    super('crypto-agent');
    this.mcpClient = mcpClient;
    this.logger = new Logger('CryptoAgent');
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    // const trace = await startTrace('crypto_agent_analyze', { symbols: state.symbols });

    try {
      if (!state.symbols) {
        const error = 'No symbols provided for analysis';
        // await endTrace(trace?.id, null, error);
        return {
          errors: [...(state.errors || []), error],
          agentStatus: {
            ...state.agentStatus,
            crypto: 'failed'
          }
        };
      }

      this.logger.info(`Crypto agent analyzing: ${state.symbols.join(', ')}`);
      
      const cryptoSymbols = this.filterCryptoSymbols(state.symbols);
      const analyses: Record<string, CryptoAnalysis> = {};
      
      for (const symbol of cryptoSymbols) {
        try {
          // const symbolTrace = await startTrace('crypto_agent_analyze_symbol', { symbol });
          
          // MCPクライアント経由でデータ取得
          const data = await this.getCryptoData(symbol);
          const analysis = this.performAnalysis(data);
          analyses[symbol] = analysis;
          
          // await endTrace(symbolTrace?.id, analysis);
          this.logger.info(`Analyzed ${symbol}: ${analysis.recommendation}`);
        } catch (error) {
          const errorMessage = `Failed to analyze ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          // await endTrace(trace?.id, null, errorMessage);
          this.logger.error(errorMessage);
        }
      }

      // await endTrace(trace?.id, analyses);
      return {
        cryptoAnalysis: analyses,
        agentStatus: {
          ...state.agentStatus,
          crypto: 'completed'
        }
      };

    } catch (error) {
      const errorMessage = `Crypto analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      // await endTrace(trace?.id, null, errorMessage);
      this.logger.error('Crypto analysis failed:', { error: String(error) });
      return {
        errors: [...(state.errors || []), errorMessage],
        agentStatus: {
          ...state.agentStatus,
          crypto: 'failed'
        }
      };
    }
  }

  private filterCryptoSymbols(symbols: string[]): string[] {
    const cryptoSymbols = ['bitcoin', 'ethereum', 'cardano', 'solana'];
    return symbols.filter(symbol => 
      cryptoSymbols.includes(symbol.toLowerCase()) || 
      symbol.toLowerCase().includes('coin')
    );
  }

  private async getCryptoData(symbol: string): Promise<CryptoData> {
    // const trace = await startTrace('crypto_agent_get_data', { symbol });
    
    try {
      // MCP経由でCryptoサーバーからデータ取得
      const response = await this.mcpClient.callTool('crypto-server', {
        symbol: symbol.toLowerCase()
      }) as unknown as CryptoData;
      
      // await endTrace(trace?.id, response);
      return response;
    } catch (error) {
      // フォールバック: モックデータ
      this.logger.warn(`Using mock data for ${symbol}`);
      const mockData = this.getMockData(symbol);
      // await endTrace(trace?.id, mockData, error);
      return mockData;
    }
  }

  private getMockData(symbol: string): CryptoData {
    const prices: Record<string, number> = {
      'bitcoin': 45000,
      'ethereum': 3000,
      'default': 100
    };
    
    const basePrice = prices[symbol.toLowerCase()] || prices.default;
    
    return {
      symbol,
      price: basePrice * (0.95 + Math.random() * 0.1), // ±5% variation
      change24h: (Math.random() - 0.5) * 10, // -5% to +5%
      volume: Math.random() * 1000000000
    };
  }

  private performAnalysis(data: CryptoData): CryptoAnalysis {
    let recommendation: 'buy' | 'sell' | 'hold';
    let confidence: number;
    let reasoning: string;

    // シンプルな分析ロジック
    if (data.change24h > 3) {
      recommendation = 'buy';
      confidence = 0.7;
      reasoning = `Strong upward momentum (+${data.change24h.toFixed(2)}%)`;
    } else if (data.change24h < -3) {
      recommendation = 'sell';
      confidence = 0.6;
      reasoning = `Significant decline (${data.change24h.toFixed(2)}%)`;
    } else {
      recommendation = 'hold';
      confidence = 0.5;
      reasoning = `Stable price movement (${data.change24h.toFixed(2)}%)`;
    }

    return {
      symbol: data.symbol,
      price: data.price,
      change24h: data.change24h,
      recommendation,
      confidence,
      reasoning
    };
  }
}