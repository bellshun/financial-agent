import { BaseAgent } from './base-agent';
import { AgentState } from '../state';
import { NewsAnalysis, InvestmentRecommendation, FinalReport } from '../types';
import { Logger } from '../../utils/logger';
import { MemoryStore } from '../../memory/types';

export class Coordinator extends BaseAgent {
  protected override logger: Logger;
  private memory: MemoryStore;

  constructor(memory: MemoryStore) {
    super('coordinator');
    this.logger = new Logger('Coordinator');
    this.memory = memory;
  }

  override async analyze(state: AgentState): Promise<Partial<AgentState>> {
    this.logger.info('Coordinator generating final report');
    
    try {
      const startTime = Date.now();
      
      // 各エージェントの結果を統合
      const finalReport = await this.generateFinalReport(state, startTime);
      
      // メモリに結果を保存
      await this.saveToMemory(finalReport);
      
      this.logger.info('Final report generated successfully');
      
      return {
        finalReport,
        agentStatus: {
          ...state.agentStatus,
          coordinator: 'completed'
        }
      };

    } catch (error) {
      this.logger.error('Coordination failed:', { error: String(error) });
      return {
        errors: [...(state.errors || []), `Coordination failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        agentStatus: {
          ...state.agentStatus,
          coordinator: 'failed'
        }
      };
    }
  }

  private async generateFinalReport(state: AgentState, startTime: number): Promise<FinalReport> {
    const executionTime = Date.now() - startTime;
    
    // 個別推奨事項を生成
    const individualRecommendations = this.generateIndividualRecommendations(state);
    
    // 全体的な推奨事項を生成
    const overallRecommendation = this.generateOverallRecommendation(
      individualRecommendations,
      state.newsAnalysis
    );
    
    // マーケットサマリーを生成
    const marketSummary = this.generateMarketSummary(state);
    
    return {
      query: state.query || 'Investment Analysis',
      timestamp: new Date().toISOString(),
      executionTime,
      overallRecommendation,
      individualRecommendations,
      marketSummary,
      agentPerformance: {
        stock: state.agentStatus?.stock || 'pending',
        crypto: state.agentStatus?.crypto || 'pending',
        news: state.agentStatus?.news || 'pending'
      },
      errors: state.errors || []
    };
  }

  private generateIndividualRecommendations(state: AgentState): InvestmentRecommendation[] {
    const recommendations: InvestmentRecommendation[] = [];
    
    // 株式推奨事項
    if (state.stockAnalysis) {
      Object.entries(state.stockAnalysis).forEach(([symbol, analysis]) => {
        if (analysis) {
          recommendations.push({
            symbol,
            assetType: 'stock',
            recommendation: analysis.recommendation,
            confidence: analysis.confidence,
            reasoning: [analysis.reasoning],
            riskLevel: this.assessRiskLevel(analysis.confidence, 'stock')
          });
        }
      });
    }
    
    // 仮想通貨推奨事項
    if (state.cryptoAnalysis) {
      Object.entries(state.cryptoAnalysis).forEach(([symbol, analysis]) => {
        if (analysis) {
          recommendations.push({
            symbol,
            assetType: 'crypto',
            recommendation: analysis.recommendation,
            confidence: analysis.confidence,
            reasoning: [analysis.reasoning],
            riskLevel: this.assessRiskLevel(analysis.confidence, 'crypto')
          });
        }
      });
    }
    
    return recommendations;
  }

  private generateOverallRecommendation(
    recommendations: InvestmentRecommendation[],
    newsAnalysis?: NewsAnalysis
  ): FinalReport['overallRecommendation'] {
    
    if (recommendations.length === 0) {
      return {
        action: 'neutral',
        confidence: 0,
        reasoning: 'No analysis data available'
      };
    }
    
    // 推奨事項をスコア化
    let totalScore = 0;
    let totalConfidence = 0;
    
    recommendations.forEach(rec => {
      const score = rec.recommendation === 'buy' ? 1 : 
                   rec.recommendation === 'sell' ? -1 : 0;
      totalScore += score * rec.confidence;
      totalConfidence += rec.confidence;
    });
    
    const avgScore = totalScore / recommendations.length;
    const avgConfidence = totalConfidence / recommendations.length;
    
    // ニュースセンチメントを考慮
    let adjustedScore = avgScore;
    if (newsAnalysis) {
      adjustedScore = (avgScore + newsAnalysis.sentimentScore) / 2;
    }
    
    // 最終判定
    let action: 'bullish' | 'bearish' | 'neutral';
    if (adjustedScore > 0.3) action = 'bullish';
    else if (adjustedScore < -0.3) action = 'bearish';
    else action = 'neutral';
    
    const reasoning = this.generateOverallReasoning(recommendations, newsAnalysis, action);
    
    return {
      action,
      confidence: avgConfidence,
      reasoning
    };
  }

  private generateOverallReasoning(
    recommendations: InvestmentRecommendation[],
    newsAnalysis: NewsAnalysis | undefined,
    action: 'bullish' | 'bearish' | 'neutral'
  ): string {
    
    const buyCount = recommendations.filter(r => r.recommendation === 'buy').length;
    const sellCount = recommendations.filter(r => r.recommendation === 'sell').length;
    const holdCount = recommendations.filter(r => r.recommendation === 'hold').length;
    
    let reasoning = `Analysis of ${recommendations.length} assets shows ${buyCount} buy signals, ${sellCount} sell signals, and ${holdCount} hold signals.`;
    
    if (newsAnalysis) {
      const sentimentText = newsAnalysis.sentimentScore > 0.3 ? 'positive' :
                           newsAnalysis.sentimentScore < -0.3 ? 'negative' : 'neutral';
      reasoning += ` Market news sentiment is ${sentimentText} with ${newsAnalysis.marketImpact} impact.`;
    }
    
    reasoning += ` Overall recommendation: ${action}.`;
    
    return reasoning;
  }

  private generateMarketSummary(state: AgentState): FinalReport['marketSummary'] {
    const newsImpact = state.newsAnalysis ? 
      `${state.newsAnalysis.marketImpact} impact from ${state.newsAnalysis.totalArticles} news articles` :
      'No news analysis available';
    
    const sentiment = state.newsAnalysis ?
      `Market sentiment: ${state.newsAnalysis.sentimentScore > 0 ? 'Positive' : state.newsAnalysis.sentimentScore < 0 ? 'Negative' : 'Neutral'}` :
      'Sentiment: Unknown';
    
    // リスクを特定
    const keyRisks: string[] = [];
    if (state.newsAnalysis?.sentimentScore !== undefined && state.newsAnalysis.sentimentScore < -0.3) {
      keyRisks.push('Negative market sentiment');
    }
    if (state.errors && state.errors.length > 0) {
      keyRisks.push('Data collection issues');
    }
    
    // 機会を特定
    const opportunities: string[] = [];
    if (state.newsAnalysis?.sentimentScore !== undefined && state.newsAnalysis.sentimentScore > 0.3) {
      opportunities.push('Positive market momentum');
    }
    
    const buyRecommendations = this.countRecommendations(state, 'buy');
    if (buyRecommendations > 0) {
      opportunities.push(`${buyRecommendations} assets with buy signals`);
    }
    
    return {
      newsImpact,
      sentiment,
      keyRisks: keyRisks.length > 0 ? keyRisks : ['No major risks identified'],
      opportunities: opportunities.length > 0 ? opportunities : ['Limited opportunities identified']
    };
  }

  private assessRiskLevel(confidence: number, assetType: 'stock' | 'crypto'): 'low' | 'medium' | 'high' {
    // 仮想通貨は基本的にリスクが高い
    if (assetType === 'crypto') {
      return confidence > 0.7 ? 'medium' : 'high';
    }
    
    // 株式のリスク評価
    if (confidence > 0.7) return 'low';
    if (confidence > 0.5) return 'medium';
    return 'high';
  }

  private countRecommendations(state: AgentState, type: 'buy' | 'sell' | 'hold'): number {
    let count = 0;
    
    if (state.stockAnalysis) {
      count += Object.values(state.stockAnalysis).filter(a => a?.recommendation === type).length;
    }
    
    if (state.cryptoAnalysis) {
      count += Object.values(state.cryptoAnalysis).filter(a => a?.recommendation === type).length;
    }
    
    return count;
  }

  private async saveToMemory(report: FinalReport): Promise<void> {
    try {
      await this.memory.saveState({
        sessionId: `analysis-${Date.now()}`,
        timestamp: report.timestamp,
        query: report.query,
        symbols: report.individualRecommendations.map(r => r.symbol),
        finalReport: {
          summary: report.overallRecommendation.reasoning,
          recommendations: report.individualRecommendations.map(rec => ({
            symbol: rec.symbol,
            action: rec.recommendation,
            reason: rec.reasoning.join(', ')
          })),
          confidence: report.overallRecommendation.confidence
        }
      });
      
      this.logger.info('Report saved to memory successfully');
    } catch (error) {
      this.logger.error('Failed to save report to memory:', { error: String(error) });
      // メモリ保存失敗はクリティカルエラーではない
    }
  }
}