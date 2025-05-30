import { z } from 'zod';

/**
 * crypt-server
 */
export const CryptoPriceSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

export const MarketDataSchema = z.object({
  symbol: z.string().min(1, "Symbol is required")
});

export const CoinGeckoPriceResponseSchema = z.record(
  z.object({
    usd: z.number(),
    usd_24h_change: z.number().optional()
  })
);

export const CoinGeckoMarketDataSchema = z.object({
  market_data: z.object({
    current_price: z.object({
      usd: z.number()
    }),
    market_cap: z.object({
      usd: z.number()
    }),
    total_volume: z.object({
      usd: z.number()
    }),
    price_change_percentage_24h: z.number()
  })
});

/**
 * news-server
 */
export const FinancialNewsSchema = z.object({
  symbols: z.array(z.string().min(1, "Symbol cannot be empty")).min(1, "At least one symbol is required"),
  limit: z.number().int().min(1).max(100).default(10).optional()
});

export const NewsAPIResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number().optional(),
  articles: z.array(z.object({
    title: z.string(),
    description: z.string().nullable(),
    url: z.string(),
    publishedAt: z.string(),
    source: z.object({
      name: z.string()
    })
  })).optional(),
  message: z.string().optional()
});

export const SearchNewsSchema = z.object({
    query: z.string().min(1, "Search query is required"),
    limit: z.number().int().min(1).max(100).default(10).optional(),
    sortBy: z.enum(["relevancy", "popularity", "publishedAt"]).default("publishedAt").optional()
});

/**
 * stock-server
 */
export const StockQuoteSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").toUpperCase()
});

export const TechnicalIndicatorsSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").toUpperCase(),
  period: z.enum(["daily", "weekly"]).default("daily").optional()
});

export const AlphaVantageQuoteResponseSchema = z.object({
  "Global Quote": z.object({
    "01. symbol": z.string(),
    "05. price": z.string(),
    "09. change": z.string(),
    "10. change percent": z.string()
  }).optional(),
  "Error Message": z.string().optional(),
  "Note": z.string().optional()
});

export const AlphaVantageTimeSeriesResponseSchema = z.object({
  "Time Series (Daily)": z.record(z.object({
    "1. open": z.string(),
    "2. high": z.string(),
    "3. low": z.string(),
    "4. close": z.string(),
    "5. volume": z.string()
  })).optional(),
  "Error Message": z.string().optional(),
  "Note": z.string().optional()
});