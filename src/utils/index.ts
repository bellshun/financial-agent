// ユーティリティ関数のエクスポート
export * from './config.js';
export * from './logger.js';

// 共通のヘルパー関数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidSymbol(symbol: string): boolean {
  // 基本的な株式シンボルの検証
  return /^[A-Z]{1,5}$/.test(symbol.toUpperCase()) || 
         // または暗号通貨の検証
         ['bitcoin', 'ethereum', 'litecoin', 'ripple', 'cardano'].includes(symbol.toLowerCase());
}

export function parseSymbols(symbolsString: string): string[] {
  return symbolsString
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter(isValidSymbol);
}

export function calculateTimeAgo(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    return `${diffDays} days ago`;
  }
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '');
}

export function createRetryFunction<T>(
  fn: () => Promise<T>, 
  maxRetries: number = 3, 
  delayMs: number = 1000
): () => Promise<T> {
  return async () => {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await delay(delayMs * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  };
}