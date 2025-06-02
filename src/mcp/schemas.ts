import { z } from 'zod';

// get_crypto_priceツールのスキーマ
export const CryptoPriceSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

// get_crypto_priceツールが実行するAPIレスポンス
export const CoinGeckoPriceResponseSchema = z.record(
  z.object({
    usd: z.number().describe("現在の値段"),
    usd_24h_change: z.number().optional().describe("過去24時間の価格変動率(USDのみ)")
  })
);

// get_market_dataツールのスキーマ
export const MarketDataSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

// get_market_dataツールが実行するAPIレスポンス
export const CoinGeckoMarketDataSchema = z.object({
  market_data: z.object({
    current_price: z.object({
      usd: z.number().describe("現在の値段")
    }),
    market_cap: z.object({
      usd: z.number().describe("仮想通貨の時価総額")
    }),
    total_volume: z.object({
      usd: z.number().describe("一定期間内に取引された仮想通貨の総量")
    }),
    price_change_percentage_24h: z.number().describe("過去24時間の価格変動率")
  })
});

// search_symbolツールのスキーマ
export const SymbolSearchSchema = z.object({
  input: z.string().describe("ユーザーからの入力テキスト。仮想通貨のシンボルを含む可能性がある。")
});

// search_symbolツールが実行するAPIレスポンス
export const SymbolSearchResponseSchema = z.array(
  z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string()
  })
);

// get_financial_newsツールのスキーマ
export const FinancialNewsSchema = z.object({
  symbols: z.array(z.string().min(1, "Symbol cannot be empty")).min(1, "At least one symbol is required"),
  limit: z.number().int().min(1).max(100).default(10).optional()
});

// get_financial_newsツール, search_newsツールが実行するAPIレスポンス
export const NewsAPIResponseSchema = z.object({
  status: z.string().describe("成功有無(ok, error)"),
  totalResults: z.number().optional().describe("結果の総数"),
  articles: z.array(z.object({
    title: z.string().describe("ニュースタイトル"),
    description: z.string().nullable().describe("説明"),
    url: z.string().describe("記事のURL"),
    publishedAt: z.string().describe("投稿日時"),
    source: z.object({
      name: z.string()
    })
  })).optional(),
  message: z.string().optional()
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

// get_stock_quoteツールが実行するAPIレスポンス
export const AlphaVantageQuoteResponseSchema = z.object({
  "Global Quote": z.object({
    "01. symbol": z.string().describe("シンボル"),
    "05. price": z.string().describe("最新の株価"),
    "09. change": z.string().describe("前日の終値と比べた現在の価格の差額"),
    "10. change percent": z.string().describe("前日比の変化率")
  }).optional(),
  "Error Message": z.string().optional(),
  "Note": z.string().optional()
});

// get_technical_indicatorsツールのスキーマ
export const TechnicalIndicatorsSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").toUpperCase(),
  period: z.enum(["daily", "weekly"]).default("daily").optional()
});

// get_technical_indicatorsツールが実行するAPIレスポンス
export const AlphaVantageTimeSeriesResponseSchema = z.object({
  "Time Series (Daily)": z.record(z.object({
    "1. open": z.string().describe("始値"),
    "2. high": z.string().describe("高値"),
    "3. low": z.string().describe("低値"),
    "4. close": z.string().describe("終値"),
    "5. volume": z.string().describe("取引量")
  })).optional(),
  "Error Message": z.string().optional(),
  "Note": z.string().optional()
});