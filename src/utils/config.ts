import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env ファイルを読み込み
dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface Config {
  // API Keys
  alphaVantageApiKey: string;
  
  // Server settings
  port: number;
  host: string;
  
  // Database
  databasePath: string;
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logToFile: boolean;
  logFilePath: string;
  
  // Analysis settings
  defaultSymbols: string[];
  maxConcurrentAnalysis: number;
  analysisTimeout: number; // milliseconds
  
  // Cache settings
  enableCache: boolean;
  cacheExpirationHours: number;
  
  // Memory settings
  maxSessions: number;
  sessionRetentionDays: number;
}

export const config: Config = {
  // API Keys
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  
  // Server settings
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost',
  
  // Database
  databasePath: process.env.DATABASE_PATH || './data/analysis.db',
  
  // Logging
  logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
  logToFile: process.env.LOG_TO_FILE === 'true',
  logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
  
  // Analysis settings
  defaultSymbols: (process.env.DEFAULT_SYMBOLS || 'AAPL,MSFT,bitcoin,ethereum').split(','),
  maxConcurrentAnalysis: parseInt(process.env.MAX_CONCURRENT_ANALYSIS || '3'),
  analysisTimeout: parseInt(process.env.ANALYSIS_TIMEOUT || '30000'),
  
  // Cache settings
  enableCache: process.env.ENABLE_CACHE !== 'false',
  cacheExpirationHours: parseInt(process.env.CACHE_EXPIRATION_HOURS || '1'),
  
  // Memory settings
  maxSessions: parseInt(process.env.MAX_SESSIONS || '100'),
  sessionRetentionDays: parseInt(process.env.SESSION_RETENTION_DAYS || '30')
};

// 設定の検証
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.alphaVantageApiKey) {
    errors.push('ALPHA_VANTAGE_API_KEY is required');
  }
  
  if (config.maxConcurrentAnalysis < 1) {
    errors.push('MAX_CONCURRENT_ANALYSIS must be at least 1');
  }
  
  if (config.analysisTimeout < 1000) {
    errors.push('ANALYSIS_TIMEOUT must be at least 1000ms');
  }
  
  if (config.cacheExpirationHours < 0) {
    errors.push('CACHE_EXPIRATION_HOURS must be non-negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 環境別設定
export function getEnvironment(): 'development' | 'production' | 'test' {
  return (process.env.NODE_ENV as any) || 'development';
}

export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

export function isTest(): boolean {
  return getEnvironment() === 'test';
}