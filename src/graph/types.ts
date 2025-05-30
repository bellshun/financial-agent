export interface NewsItem {
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: number; // 0 to 1
}

export interface Recommendation {
  symbol: string;
  assetType: 'stock' | 'crypto';
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AnalysisState {
  // 入力
  query: string;
  symbols: string[];
  
  // 各エージェントの分析結果
  stockAnalysis?: StockAnalysisResult[];
  cryptoAnalysis?: CryptoAnalysisResult[];
  newsAnalysis?: NewsAnalysisResult[];
  
  // 最終結果
  finalReport?: FinalReport;
  
  // メタデータ
  timestamp: string;
  sessionId: string;
}

export interface StockAnalysisResult {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  technicalIndicators: {
    sma20: number;
    rsi: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
  };
}

export interface CryptoAnalysisResult {
  symbol: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
}

export interface NewsAnalysisResult {
  relevantNews: NewsItem[];
  sentimentScore: number; // -1 to 1
  impactAssessment: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InvestmentRecommendation {
  symbol: string;
  assetType: 'stock' | 'crypto';
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FinalReport {
  query: string;
  timestamp: string;
  executionTime: number;
  overallRecommendation: {
    action: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string;
  };
  individualRecommendations: InvestmentRecommendation[];
  marketSummary: {
    newsImpact: string;
    sentiment: string;
    keyRisks: string[];
    opportunities: string[];
  };
  agentPerformance: {
    stock: 'completed' | 'failed' | 'pending';
    crypto: 'completed' | 'failed' | 'pending';
    news: 'completed' | 'failed' | 'pending';
  };
  errors: string[];
}

export type AgentStatusType = 'completed' | 'failed' | 'pending';

export interface AgentStatus {
  stock?: AgentStatusType;
  crypto?: AgentStatusType;
  news?: AgentStatusType;
  coordinator?: AgentStatusType;
  [key: string]: AgentStatusType | undefined;
}

export interface StockAnalysis {
  symbol: string;
  price: number;
  change24h: number;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
}

export interface StockData {
  price: number;
  change: number;
  changePercent: number;
}

export interface TechnicalData {
  sma20: number;
  rsi: number;
  recommendation: 'buy' | 'sell' | 'hold';
}

export interface CryptoData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
}

export interface CryptoAnalysis {
  symbol: string;
  price: number;
  change24h: number;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: number;
}

export interface NewsAnalysis {
  totalArticles: number;
  sentimentScore: number; // -1 to 1
  keyTopics: string[];
  marketImpact: 'high' | 'medium' | 'low';
  summary: string;
} 