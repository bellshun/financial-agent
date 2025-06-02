import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export interface WorkflowConfig {
    // Ollamaの設定
    ollamaHost?: string;
    defaultModel?: string;
    analysisModel?: string;
    synthesisModel?: string;
    temperature?: {
      analysis?: number;
      synthesis?: number;
    };
    // MCPサーバーの設定
    mcpServers?: {
      crypto: { command: string; args: string[] };
      news: { command: string; args: string[] };
      stock: { command: string; args: string[] };
    };
    callbacks?: BaseCallbackHandler[];
}

// 分析可能なシンボルへのマップ
export const SYMBOL_MAPPING: Record<string, string> = {
    'BTC': 'bitcoin',
    'BITCOIN': 'bitcoin',
    'ETH': 'ethereum', 
    'ETHEREUM': 'ethereum',
    'ADA': 'cardano',
    'CARDANO': 'cardano',
    'SOL': 'solana',
    'SOLANA': 'solana',
    'BNB': 'binancecoin',
    'BINANCE': 'binancecoin',
    'XRP': 'ripple',
    'RIPPLE': 'ripple',
    'DOGE': 'dogecoin',
    'DOGECOIN': 'dogecoin',
    'DOT': 'polkadot',
    'POLKADOT': 'polkadot',
    'AVAX': 'avalanche-2',
    'AVALANCHE': 'avalanche-2',
    'LINK': 'chainlink',
    'CHAINLINK': 'chainlink',
    'MATIC': 'polygon',
    'POLYGON': 'polygon',
    'UNI': 'uniswap',
    'UNISWAP': 'uniswap',
    'LTC': 'litecoin',
    'LITECOIN': 'litecoin'
};