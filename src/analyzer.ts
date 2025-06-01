import { Ollama } from 'ollama';
import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { AnalysisSummary, CryptoAnalysis, NewsData } from './type';
import { createAnalysisPrompt, createSynthesisPrompt } from './prompts';

// Zod スキーマ定義
const AnalysisResultSchema = z.object({
  recommendation: z.enum(['buy', 'sell', 'hold']).default('hold'),
  confidence: z.number().min(0).max(1).default(0.5),
  reasoning: z.string().default('分析データが不十分なため、慎重な判断が必要です。')
});

const AnalysisSummarySchema = z.object({
  overallSentiment: z.enum(['bullish', 'bearish', 'neutral']).default('neutral'),
  keyFindings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  summary: z.string().default(''),
  confidenceScore: z.number().min(0).max(1).default(0.5)
});

export interface AnalyzerConfig {
  defaultModel: string;
  analysisModel: string;
  synthesisModel: string;
  temperature: {
    analysis: number;
    synthesis: number;
  };
}

export class CryptoAnalyzer {
  private config: AnalyzerConfig;

  constructor(
    private ollama: Ollama,
    config: Partial<AnalyzerConfig> = {}
  ) {
    this.config = {
      defaultModel: config.defaultModel || 'llama3.2',
      analysisModel: config.analysisModel || config.defaultModel || 'llama3.2',
      synthesisModel: config.synthesisModel || config.defaultModel || 'llama3.2',
      temperature: {
        analysis: config.temperature?.analysis ?? 0.2,
        synthesis: config.temperature?.synthesis ?? 0.3
      }
    };
  }

  async performComprehensiveAnalysis(
    data: any, 
    toolName: string,
    targetSymbol: string,
    marketContext: string,
    newsContext: NewsData[]
  ): Promise<CryptoAnalysis | null> {
    try {
      let analysisData: any = {};
      
      if (toolName === 'get_crypto_price' && data.symbol) {
        analysisData = {
          symbol: targetSymbol,
          price: data.price,
          change24h: data.change24h || 0,
          rawData: data
        };
      } else if (toolName === 'get_market_data' && data.symbol) {
        analysisData = {
          symbol: targetSymbol,
          price: data.currentPrice,
          change24h: data.priceChange24h || 0,
          marketCap: data.marketCap,
          volume24h: data.volume24h,
          recommendation: data.recommendation as 'buy' | 'sell' | 'hold',
          rawData: data
        };
      } else {
        console.warn(`Unsupported tool or missing data: ${toolName}, targetSymbol: ${targetSymbol}`);
        return null;
      }

      const relevantNews = newsContext.filter(news => {
        if (!news || !news.title) return false;
        const title = news.title.toLowerCase();
        const symbol = targetSymbol.toLowerCase();
        return title.includes(symbol) || title.includes(analysisData.symbol.toLowerCase());
      });

      const marketCap = analysisData.marketCap ? `- 時価総額: ${analysisData.marketCap}` : '';
      const volume24h = analysisData.volume24h ? `- 24h出来高: ${analysisData.volume24h}` : '';

      const jsonSchema = `{
  "recommendation": "buy" | "sell" | "hold"のいずれか,
  "confidence": 0から1の間の数値,
  "reasoning": "分析の理由を詳しく説明"
}`;

      const promptTemplate = createAnalysisPrompt();
      const formattedPrompt = await promptTemplate.format({
        targetSymbol,
        price: analysisData.price,
        change24h: analysisData.change24h,
        marketContext,
        relevantNews: relevantNews.map(news => `- ${news.title} (${news.sentiment || 'neutral'})`).join('\n') || 'なし',
        marketCap,
        volume24h,
        recommendation: analysisData.recommendation || 'なし',
        jsonSchema
      });

      const response = await this.ollama.chat({
        model: this.config.analysisModel,
        messages: [{ role: 'user', content: formattedPrompt }],
        format: 'json',
        options: {
          temperature: this.config.temperature.analysis,
          num_predict: 800
        }
      });

      let aiResult;
      try {
        const parsedContent = JSON.parse(response.message.content);
        console.log('Raw LLM response:', parsedContent);
        
        aiResult = {
          recommendation: 'hold' as const,
          confidence: 0.5,
          reasoning: `${targetSymbol}の分析が不完全です。`,
          ...parsedContent
        };
        
        aiResult = AnalysisResultSchema.parse(aiResult);
      } catch (parseError) {
        console.warn(`Analysis parsing failed for ${targetSymbol}:`, parseError);
        aiResult = {
          recommendation: 'hold' as const,
          confidence: 0.5,
          reasoning: `${targetSymbol}の自動分析が失敗しました。現在価格$${analysisData.price}、24h変動${analysisData.change24h}%の状況下で慎重な判断が必要です。`
        };
      }
      
      const analysis: CryptoAnalysis = {
        symbol: targetSymbol,
        price: analysisData.price,
        change24h: analysisData.change24h,
        marketCap: analysisData.marketCap,
        volume24h: analysisData.volume24h,
        recommendation: aiResult.recommendation,
        confidence: Math.max(0, Math.min(1, aiResult.confidence)),
        reasoning: aiResult.reasoning,
        technicalIndicators: {
          priceChange24h: analysisData.change24h,
          volume: analysisData.volume24h,
          marketCap: analysisData.marketCap,
          targetSymbol: targetSymbol
        }
      };

      return analysis;
    } catch (error) {
      console.error(`Analysis failed for ${targetSymbol}:`, error);
      return null;
    }
  }

  async synthesizeResults(
    analysisResults: CryptoAnalysis[],
    query: string,
    marketContext: string,
    newsContext: NewsData[]
  ): Promise<AnalysisSummary> {
    try {
      console.log(`Synthesizing results for ${analysisResults.length} analyses:`, 
        analysisResults.map(a => `${a.symbol}: ${a.recommendation}`));

      const jsonSchema = `{
  "overallSentiment": "bullish" | "bearish" | "neutral"のいずれか,
  "keyFindings": ["重要な発見1", "重要な発見2", "重要な発見3"],
  "recommendations": ["具体的な推奨事項1", "具体的な推奨事項2"],
  "summary": "分析した銘柄の市場分析と投資判断のサマリー",
  "confidenceScore": 0から1の間の数値
}`;

      const promptTemplate = createSynthesisPrompt();
      const formattedPrompt = await promptTemplate.format({
        query,
        marketContext,
        analysisResults: analysisResults.map((analysis, index) => `
${index + 1}. シンボル: ${analysis.symbol}
   価格: $${analysis.price}
   24h変動: ${analysis.change24h}%
   推奨: ${analysis.recommendation}
   信頼度: ${(analysis.confidence * 100).toFixed(1)}%
   理由: ${analysis.reasoning}
   ${analysis.marketCap ? `時価総額: $${analysis.marketCap}` : ''}
   ${analysis.volume24h ? `24h出来高: $${analysis.volume24h}` : ''}
`).join('\n---\n'),
        newsContext: newsContext.map(news => `- ${news.title} (${news.sentiment || 'neutral'})`).join('\n') || 'なし',
        jsonSchema
      });

      const response = await this.ollama.chat({
        model: this.config.synthesisModel,
        messages: [{ role: 'user', content: formattedPrompt }],
        format: 'json',
        options: {
          temperature: this.config.temperature.synthesis,
          num_predict: 1000
        }
      });

      let finalSummary: AnalysisSummary;
      
      try {
        const parsedContent = JSON.parse(response.message.content);
        console.log('Raw synthesis response:', parsedContent);
        
        const defaultSummary = {
          overallSentiment: 'neutral' as const,
          keyFindings: [],
          recommendations: [],
          summary: '',
          confidenceScore: 0.5
        };
        
        finalSummary = {
          ...defaultSummary,
          ...parsedContent
        };
        
        finalSummary = AnalysisSummarySchema.parse(finalSummary);
      } catch (parseError) {
        console.warn('Summary parsing failed, using fallback:', parseError);
        
        const bullishCount = analysisResults.filter(a => a.recommendation === 'buy').length;
        const bearishCount = analysisResults.filter(a => a.recommendation === 'sell').length;
        const avgConfidence = analysisResults.reduce((sum, a) => sum + a.confidence, 0) / analysisResults.length;
        
        finalSummary = {
          overallSentiment: bullishCount > bearishCount ? 'bullish' : 
                           bearishCount > bullishCount ? 'bearish' : 'neutral',
          keyFindings: analysisResults.map(a => `${a.symbol}: ${a.recommendation} (信頼度${(a.confidence * 100).toFixed(0)}%)`),
          recommendations: [
            '市場動向を継続的に監視してください',
            'リスク管理を徹底し、適切なポジションサイズを維持してください',
            `分析した${analysisResults.length}銘柄の中で${bullishCount}銘柄が買い推奨、${bearishCount}銘柄が売り推奨です`
          ],
          summary: `${analysisResults.length}の暗号通貨を分析した結果、全体的な市場センチメントは${bullishCount > bearishCount ? '強気' : bearishCount > bullishCount ? '弱気' : '中立'}です。平均信頼度は${(avgConfidence * 100).toFixed(1)}%となっています。`,
          confidenceScore: avgConfidence
        };
      }

      return finalSummary;
    } catch (error) {
      console.error('Result synthesis failed:', error);
      
      const fallbackSummary: AnalysisSummary = {
        overallSentiment: 'neutral',
        keyFindings: analysisResults.map(a => `${a.symbol}: ${a.recommendation}`),
        recommendations: ['詳細な分析は失敗しましたが、個別の推奨事項を参照してください'],
        summary: `${analysisResults.length}銘柄の分析を実行しましたが、統合処理でエラーが発生しました。個別の分析結果を確認してください。`,
        confidenceScore: 0.5
      };

      return fallbackSummary;
    }
  }

  generateMarketContext(symbols: string[], newsData: NewsData[]): string {
    if (symbols.length === 0) {
      return '市場コンテキストが限定的です';
    }

    const newsCount = newsData.length;
    const sentimentCounts = newsData.reduce((acc, news) => {
      acc[news.sentiment || 'neutral']++;
      return acc;
    }, { positive: 0, negative: 0, neutral: 0 });

    return `
対象銘柄: ${symbols.join(', ')}
関連ニュース: ${newsCount}件
ニュースセンチメント - ポジティブ: ${sentimentCounts.positive}件, ネガティブ: ${sentimentCounts.negative}件, 中立: ${sentimentCounts.neutral}件
市場の注目度: ${newsCount > 10 ? '高' : newsCount > 5 ? '中' : '低'}
    `.trim();
  }
} 