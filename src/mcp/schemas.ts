import { z } from 'zod';

export const CryptoPriceSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .describe("coins' IDs, comma-separated if querying more than 1 coin. *refers search_symbol tool.")
});

export const MarketDataSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .describe("coins' IDs, comma-separated if querying more than 1 coin. *refers search_symbol tool.")
});

export const SymbolSearchSchema = z.object({});

export const FinancialNewsSchema = z.object({
  symbols: z
    .array(z
      .string()
      .min(1, "Symbol cannot be empty")
      .describe("Keywords or phrases to search for in the article title and body")
    )
    .min(1, "At least one symbol is required"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .describe("The number of results to return per page.")
});

export const SearchNewsSchema = z.object({
    query: z
      .string()
      .min(1, "Search query is required")
      .describe("Keywords or phrases to search for in the article title and body"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .optional()
      .describe("The number of results to return per page."),
    sortBy: z
      .enum(["relevancy", "popularity", "publishedAt"])
      .default("publishedAt")
      .optional()
      .describe("The order to sort the articles in. Possible options: relevancy, popularity, publishedAt.")
});

export const StockQuoteSchema = z.object({
  symbol: z
    .string()
    .min(1, "Stock symbol is required")
    .toUpperCase()
    .describe("The symbol of the global ticker of your choice. For example: IBM.")
});

export const TechnicalIndicatorsSchema = z.object({
  symbol: z
    .string()
    .min(1, "Stock symbol is required")
    .toUpperCase()
    .describe("The name of the equity of your choice. For example: IBM."),
});