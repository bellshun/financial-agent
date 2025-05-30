import { AgentState } from '../state';
import { NewsArticle, NewsAnalysis } from '../types';
import { MCPClient } from '../../clients/mcp-client';
import { Logger } from '../../utils/logger';

export class NewsAgent {
  private mcpClient: MCPClient;
  private logger: Logger;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.logger = new Logger('news-agent');
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    this.logger.info('News agent starting analysis');
    
    if (!state.symbols) {
      return {
        errors: [...(state.errors || []), 'No symbols provided for analysis'],
        agentStatus: {
          ...state.agentStatus,
          news: 'failed'
        }
      };
    }
    
    try {
      // MCPクライアント経由でニュース取得
      const articles = await this.getMarketNews(state.symbols);
      
      // ニュース分析実行
      const analysis = this.analyzeNews(articles);
      
      this.logger.info(`Analyzed ${articles.length} news articles`);
      
      return {
        newsAnalysis: analysis,
        agentStatus: {
          ...state.agentStatus,
          news: 'completed'
        }
      };

    } catch (error) {
      this.logger.error('News analysis failed:', { error: String(error) });
      return {
        errors: [...(state.errors || []), `News analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        agentStatus: {
          ...state.agentStatus,
          news: 'failed'
        }
      };
    }
  }

  private async getMarketNews(symbols: string[]): Promise<NewsArticle[]> {
    try {
      // MCP経由でNewsサーバーからデータ取得
      const response = await this.mcpClient.callTool({
        name: 'news-server', 
        arguments: {
          symbols,
          limit: 20
        }
      });

      // レスポンスの構造を確認してデータを抽出
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          // JSON文字列をパース
          const marketNews = JSON.parse(textContent.text) as NewsArticle[];
          // await endTrace(trace?.id, marketNews);
          return marketNews;
        }
      }
      
      return response.articles as NewsArticle[];
    } catch (error) {
      // フォールバック: モックデータ
      this.logger.warn('Using mock news data');
      return this.getMockNews(symbols);
    }
  }

  private getMockNews(symbols: string[]): NewsArticle[] {
    const mockArticles: NewsArticle[] = [
      {
        title: "Market Shows Strong Growth Signals",
        url: "https://example.com/market-growth",
        source: "Financial Times",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        sentiment: 'positive',
        relevance: 0.8
      },
      {
        title: "Tech Sector Faces Regulatory Challenges",
        url: "https://example.com/tech-regulation",
        source: "TechCrunch",
        publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        sentiment: 'negative',
        relevance: 0.7
      },
      {
        title: "Crypto Market Stabilizes After Volatility",
        url: "https://example.com/crypto-stable",
        source: "CoinDesk",
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        sentiment: 'neutral',
        relevance: 0.6
      }
    ];

    // シンボル固有のニュースを追加
    symbols.forEach(symbol => {
      mockArticles.push({
        title: `${symbol.toUpperCase()} Reports Quarterly Results`,
        url: `https://example.com/${symbol}-earnings`,
        source: "MarketWatch",
        publishedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000).toISOString(),
        sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
        relevance: 0.9
      });
    });

    return mockArticles;
  }

  private analyzeNews(articles: NewsArticle[]): NewsAnalysis {
    if (articles.length === 0) {
      return {
        totalArticles: 0,
        sentimentScore: 0,
        keyTopics: [],
        marketImpact: 'low',
        summary: 'No news articles available for analysis'
      };
    }

    // センチメントスコア計算
    let sentimentSum = 0;
    articles.forEach(article => {
      const weight = article.relevance || 0.5;
      switch (article.sentiment) {
        case 'positive':
          sentimentSum += weight;
          break;
        case 'negative':
          sentimentSum -= weight;
          break;
        case 'neutral':
          // no change
          break;
      }
    });
    
    const sentimentScore = sentimentSum / articles.length;

    // キートピック抽出（簡易版）
    const keyTopics = this.extractKeyTopics(articles);

    // マーケットインパクト評価
    const marketImpact = this.assessMarketImpact(articles, sentimentScore);

    // サマリー生成
    const summary = this.generateSummary(articles, sentimentScore, marketImpact);

    return {
      totalArticles: articles.length,
      sentimentScore,
      keyTopics,
      marketImpact,
      summary
    };
  }

  private extractKeyTopics(articles: NewsArticle[]): string[] {
    // 簡易キーワード抽出
    const keywords = ['growth', 'earnings', 'regulation', 'technology', 'crypto', 'market', 'volatility'];
    const topicCounts = new Map<string, number>();

    articles.forEach(article => {
      const title = article.title.toLowerCase();
      keywords.forEach(keyword => {
        if (title.includes(keyword)) {
          topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + 1);
        }
      });
    });

    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private assessMarketImpact(articles: NewsArticle[], sentimentScore: number): 'high' | 'medium' | 'low' {
    const highImpactKeywords = ['federal reserve', 'interest rates', 'earnings', 'regulation'];
    let impactScore = 0;

    articles.forEach(article => {
      const title = article.title.toLowerCase();
      const hasHighImpactKeyword = highImpactKeywords.some(keyword => title.includes(keyword));
      if (hasHighImpactKeyword) {
        impactScore += article.relevance || 0.5;
      }
    });

    const avgImpact = impactScore / articles.length;
    
    if (avgImpact > 0.6 || Math.abs(sentimentScore) > 0.7) return 'high';
    if (avgImpact > 0.3 || Math.abs(sentimentScore) > 0.3) return 'medium';
    return 'low';
  }

  private generateSummary(articles: NewsArticle[], sentimentScore: number, marketImpact: string): string {
    const positiveCount = articles.filter(a => a.sentiment === 'positive').length;
    const negativeCount = articles.filter(a => a.sentiment === 'negative').length;
    
    let sentimentText = 'neutral';
    if (sentimentScore > 0.3) sentimentText = 'positive';
    else if (sentimentScore < -0.3) sentimentText = 'negative';
    
    return `Analyzed ${articles.length} articles with ${sentimentText} sentiment (${positiveCount} positive, ${negativeCount} negative). Market impact assessed as ${marketImpact}.`;
  }
}