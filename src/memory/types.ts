// メモリ関連の型定義

export interface MemoryStore {
  initialize(): Promise<void>;
  saveState(state: AnalysisSession): Promise<void>;
  getRecentSessions(limit: number): Promise<AnalysisSession[]>;
  getSessionById(sessionId: string): Promise<AnalysisSession | null>;
  cleanOldSessions(cutoffDate: Date): Promise<number>;
  close(): Promise<void>;
}

export interface AnalysisSession {
  sessionId: string;
  timestamp: string;
  query: string;
  symbols: string[];
  marketData?: any[];
  newsData?: any[];
  finalReport?: {
    summary: string;
    recommendations: Array<{
      symbol: string;
      action: string;
      reason: string;
    }>;
    confidence: number;
  } | null;
  metadata?: Record<string, any>;
}

export interface SessionMetadata {
  sessionId: string;
  timestamp: string;
  query: string;
  symbols: string[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  duration?: number; // 実行時間（ミリ秒）
}

export interface AnalysisCache {
  symbol: string;
  dataType: 'STOCK' | 'CRYPTO' | 'NEWS';
  data: any;
  timestamp: string;
  expiresAt: string;
}

export interface MemoryConfig {
  maxSessions: number;
  sessionRetentionDays: number;
  cacheExpirationHours: number;
  enableCache: boolean;
}

// LangGraphの状態を永続化するためのインターface
export interface PersistentState {
  sessionId: string;
  currentStep: string;
  completedSteps: string[];
  state: Record<string, any>;
  created: string;
  updated: string;
}

export interface MemoryStats {
  totalSessions: number;
  activeSessions: number;
  cacheHitRate: number;
  averageAnalysisTime: number;
  storageUsage: number; // bytes
}