import { BaseMessage } from "@langchain/core/messages";

export interface CryptoData {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: string;
}

export interface MarketData {
  symbol: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  recommendation: string;
  timestamp: string;
}

export interface NewsData {
  title: string;
  content: string;
  source: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface CryptoAnalysis {
  symbol: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  technicalIndicators?: Record<string, any>;
}

export interface ExecutionStep {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  description: string;
  completed: boolean;
  result?: any;
  mcpServer?: 'crypto' | 'news' | 'stock' | undefined;
  targetSymbol: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  analysisType: 'technical' | 'fundamental' | 'sentiment' | 'comprehensive';
  priority: number;
}

export interface AnalysisSummary {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  keyFindings: string[];
  recommendations: string[];
  summary: string;
  confidenceScore: number;
}

export interface CryptoAnalysisState {
  messages: BaseMessage[];
  query: string;
  symbols: string[];
  analysisResults: CryptoAnalysis[];
  executionPlan: ExecutionPlan;
  currentStep: number;
  finalSummary: AnalysisSummary;
  marketContext: string;
  newsContext: NewsData[];
  error?: string;
}
