import { z } from 'zod';

// get_crypto_priceツールのスキーマ
export const CryptoPriceSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

// get_market_dataツールのスキーマ
export const MarketDataSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

// search_symbolツールのスキーマ
export const SymbolSearchSchema = z.object({
  input: z.string().describe("ユーザーからの入力テキスト。仮想通貨のシンボルを含む可能性がある。")
});

// get_financial_newsツールのスキーマ
export const FinancialNewsSchema = z.object({
  symbols: z.array(z.string().min(1, "Symbol cannot be empty")).min(1, "At least one symbol is required"),
  limit: z.number().int().min(1).max(100).default(10).optional()
});

// search_newsツールのスキーマ
export const SearchNewsSchema = z.object({
    query: z.string().min(1, "Search query is required"),
    limit: z.number().int().min(1).max(100).default(10).optional(),
    sortBy: z.enum(["relevancy", "popularity", "publishedAt"]).default("publishedAt").optional()
});

// get_stock_quoteツールのスキーマ
export const StockQuoteSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").toUpperCase()
});
// get_technical_indicatorsツールのスキーマ
export const TechnicalIndicatorsSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").toUpperCase(),
  period: z.enum(["daily", "weekly"]).default("daily").optional()
});