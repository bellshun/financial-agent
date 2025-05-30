import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AnalysisSession } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MemoryStore {
  initialize(): Promise<void>;
  saveState(state: AnalysisSession): Promise<void>;
  getRecentSessions(limit: number): Promise<AnalysisSession[]>;
  getSessionById(sessionId: string): Promise<AnalysisSession | null>;
  cleanOldSessions(cutoffDate: Date): Promise<number>;
  close(): Promise<void>;
}

class SQLiteMemoryStore implements MemoryStore {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    const dataDir = join(__dirname, '..', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = dbPath || join(dataDir, 'financial_analysis.db');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      
      // WALモードを有効にしてパフォーマンスを向上
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      
      // テーブル作成
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS analysis_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          timestamp TEXT NOT NULL,
          query TEXT NOT NULL,
          symbols TEXT NOT NULL,
          market_data TEXT,
          news_data TEXT,
          final_report TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_session_id ON analysis_sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON analysis_sessions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_created_at ON analysis_sessions(created_at);
      `);
      
      console.log('✅ SQLite memory store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite memory store:', error);
      throw error;
    }
  }

  async saveState(state: AnalysisSession): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO analysis_sessions 
        (session_id, timestamp, query, symbols, market_data, news_data, final_report, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        state.sessionId,
        state.timestamp,
        state.query,
        JSON.stringify(state.symbols),
        state.marketData ? JSON.stringify(state.marketData) : null,
        state.newsData ? JSON.stringify(state.newsData) : null,
        state.finalReport ? JSON.stringify(state.finalReport) : null,
        state.metadata ? JSON.stringify(state.metadata) : null
      );

      console.log(`💾 Saved analysis session: ${state.sessionId}`);
    } catch (error) {
      console.error('❌ Failed to save session:', error);
      throw error;
    }
  }

  async getRecentSessions(limit: number = 10): Promise<AnalysisSession[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM analysis_sessions 
        ORDER BY created_at DESC 
        LIMIT ?
      `);

      const rows = stmt.all(limit);
      
      return rows.map(row => this.rowToSession(row));
    } catch (error) {
      console.error('❌ Failed to retrieve recent sessions:', error);
      throw error;
    }
  }

  async getSessionById(sessionId: string): Promise<AnalysisSession | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM analysis_sessions 
        WHERE session_id = ?
      `);

      const row = stmt.get(sessionId);
      
      return row ? this.rowToSession(row) : null;
    } catch (error) {
      console.error('❌ Failed to retrieve session:', error);
      throw error;
    }
  }

  async cleanOldSessions(cutoffDate: Date): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        DELETE FROM analysis_sessions 
        WHERE created_at < ?
      `);

      const result = stmt.run(cutoffDate.toISOString());
      
      console.log(`🧹 Cleaned ${result.changes} old sessions`);
      return result.changes || 0;
    } catch (error) {
      console.error('❌ Failed to clean old sessions:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 Database connection closed');
    }
  }

  private rowToSession(row: any): AnalysisSession {
    return {
      sessionId: row.session_id,
      timestamp: row.timestamp,
      query: row.query,
      symbols: JSON.parse(row.symbols),
      marketData: row.market_data ? JSON.parse(row.market_data) : undefined,
      newsData: row.news_data ? JSON.parse(row.news_data) : undefined,
      finalReport: row.final_report ? JSON.parse(row.final_report) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}

// ファクトリー関数
export function createMemoryStore(dbPath?: string): MemoryStore {
  return new SQLiteMemoryStore(dbPath);
}

// デフォルトエクスポート（後方互換性のため）
export default SQLiteMemoryStore;