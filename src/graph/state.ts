import { Annotation } from "@langchain/langgraph";
import { NewsAnalysis } from './types';
import { CryptoAnalysis } from './types';
import {
  FinalReport,
  AgentStatus,
  StockAnalysis
} from './types';

// LangGraph用のStateAnnotation定義
export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>({
    reducer: (state, update) => update || state
  }),
  symbols: Annotation<string[]>({
    reducer: (state, update) => update || state,
    default: () => []
  }),
  timestamp: Annotation<string>({
    reducer: (state, update) => update || state
  }),
  sessionId: Annotation<string>({
    reducer: (state, update) => update || state
  }),
  stockAnalysis: Annotation<Record<string, StockAnalysis>>({
    reducer: (state, update) => update || state,
    default: () => ({})
  }),
  cryptoAnalysis: Annotation<Record<string, CryptoAnalysis>>({
    reducer: (state, update) => update || state,
    default: () => ({})
  }),
  newsAnalysis: Annotation<NewsAnalysis>({
    reducer: (state, update) => update || state
  }),
  finalReport: Annotation<FinalReport>({
    reducer: (state, update) => update || state
  }),
  agentStatus: Annotation<AgentStatus>({
    reducer: (state, update) => update || state,
    default: () => ({})
  }),
  errors: Annotation<string[]>({
    reducer: (state, update) => update || state,
    default: () => []
  })
});

// TypeScript型を生成
export type AgentState = typeof AgentStateAnnotation.State;