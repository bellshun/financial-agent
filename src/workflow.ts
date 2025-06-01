// crypto-analyzer-fixed.ts - 修正版MCPサーバー統合版
import { StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { Ollama } from 'ollama';
import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { AnalysisSummary, CryptoAnalysis, CryptoAnalysisState, ExecutionPlan, ExecutionStep, NewsData } from './type';
import { createPlanPrompt } from './prompts';
import { CryptoAnalyzer } from './analyzer';
import { MCPClientManager } from './mcp-client';

// Zod スキーマ定義 - 構造化出力用
const ExecutionPlanSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    toolName: z.string(),
    parameters: z.record(z.any()),
    description: z.string(),
    completed: z.boolean().default(false),
    mcpServer: z.enum(['crypto', 'news', 'stock']).optional(),
    targetSymbol: z.string().default('')
  })).default([]),
  analysisType: z.enum(['technical', 'fundamental', 'sentiment', 'comprehensive']).default('comprehensive'),
  priority: z.number().default(3)
});

// シンボルマッピング辞書 - より正確なマッピング
const SYMBOL_MAPPING: Record<string, string> = {
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

export interface WorkflowConfig {
  ollamaHost?: string;
  defaultModel?: string;
  analysisModel?: string;
  synthesisModel?: string;
  temperature?: {
    analysis?: number;
    synthesis?: number;
  };
  mcpServers?: {
    crypto: { command: string; args: string[] };
    news: { command: string; args: string[] };
    stock: { command: string; args: string[] };
  };
}

export class IntegratedCryptoAnalyzer {
  private ollama: Ollama;
  private analyzer: CryptoAnalyzer;
  private mcpManager: MCPClientManager;
  private graph: StateGraph<CryptoAnalysisState>;

  constructor(
    private config: WorkflowConfig = {}
  ) {
    this.ollama = new Ollama({
      host: config.ollamaHost || 'http://localhost:11434'
    });

    this.analyzer = new CryptoAnalyzer(this.ollama, {
      defaultModel: config.defaultModel || 'llama3.2',
      analysisModel: config.analysisModel || config.defaultModel || 'llama3.2',
      synthesisModel: config.synthesisModel || config.defaultModel || 'llama3.2',
      temperature: {
        analysis: config.temperature?.analysis ?? 0.2,
        synthesis: config.temperature?.synthesis ?? 0.3
      }
    });

    this.mcpManager = new MCPClientManager({ mcpServers: config.mcpServers || {
      crypto: { command: 'tsx', args: ['./src/mcp/crypto-server.ts'] },
      news: { command: 'tsx', args: ['./src/mcp/news-server.ts'] },
      stock: { command: 'tsx', args: ['./src/mcp/stock-server.ts'] }
    }});

    this.buildGraph();
  }

  private buildGraph(): void {
    this.graph = new StateGraph<CryptoAnalysisState>({
      channels: {
        // メッセージの配列を保持
        messages: { 
          value: (x: BaseMessage[], y: BaseMessage[]) => [...x, ...y],
          default: () => []
        },
        // クエリ文字列
        query: { default: () => '' },
        // 分析対象のシンボル配列
        symbols: { default: () => [] },
        // 分析結果の配列
        analysisResults: { 
          value: (x: CryptoAnalysis[], y: CryptoAnalysis[]) => [...x, ...y],
          default: () => []
        },
        // 実行計画
        executionPlan: { 
          default: () => ({ steps: [], analysisType: 'comprehensive' as const, priority: 3 })
        },
        // 現在のステップ番号
        currentStep: { default: () => 0 },
        // 市場コンテキスト
        marketContext: { default: () => '' },
        // ニュースコンテキスト
        newsContext: { default: () => [] },
        finalSummary: {
          default: () => ({
            overallSentiment: 'neutral' as const,
            keyFindings: [],
            recommendations: [],
            summary: '',
            confidenceScore: 0.5
          })
        }
      }
    });

    // ノードの追加
    this.graph.addNode('parse_query', this.parseQuery.bind(this));
    this.graph.addNode('gather_context', this.gatherMarketContext.bind(this));
    this.graph.addNode('plan_execution', this.planExecution.bind(this));
    this.graph.addNode('execute_step', this.executeStep.bind(this));
    this.graph.addNode('analyze_data', this.analyzeData.bind(this));
    this.graph.addNode('synthesize_results', this.synthesizeResults.bind(this));

    // エッジの追加
    this.graph.addEdge(START, 'parse_query');
    this.graph.addEdge('parse_query', 'gather_context');
    this.graph.addEdge('gather_context', 'plan_execution');
    this.graph.addEdge('plan_execution', 'execute_step');
    
    // 条件付きエッジの追加
    this.graph.addConditionalEdges(
      'execute_step',
      this.shouldContinueExecution.bind(this),
      {
        continue: 'analyze_data',
        next_step: 'execute_step',
        done: 'synthesize_results'
      }
    );
    
    this.graph.addEdge('analyze_data', 'execute_step');
    this.graph.addEdge('synthesize_results', END);

    // グラフのコンパイル
    this.graph = this.graph.compile();
  }

  async initialize(): Promise<void> {
    await this.mcpManager.initialize();
  }

  private extractSymbolsFromQuery(query: string): string[] {
    const upperQuery = query.toUpperCase();
    const foundSymbols: string[] = [];

    for (const [key, value] of Object.entries(SYMBOL_MAPPING)) {
      if (upperQuery.includes(key)) {
        foundSymbols.push(key);
      }
    }

    return [...new Set(foundSymbols)];
  }

  private normalizeSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    const normalized = SYMBOL_MAPPING[upperSymbol];
    if (!normalized) {
      console.warn(`Unknown symbol: ${symbol}, using lowercase as fallback`);
      return symbol.toLowerCase();
    }
    console.log(`Normalized symbol: ${symbol} -> ${normalized}`);
    return normalized;
  }

  private async parseQuery(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    const { query } = state;
    
    try {
      const symbols = this.extractSymbolsFromQuery(query);
      console.log(`Extracted symbols: ${symbols.join(', ')}`);
      
      return {
        symbols,
        messages: [...state.messages, new HumanMessage(query)]
      };
    } catch (error) {
      return {
        error: `Query parsing failed: ${error}`
      };
    }
  }

  private async gatherMarketContext(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    try {
      let newsContext: NewsData[] = [];
      let marketContext = '';

      if (state.symbols.length > 0) {
        try {
          for (const symbol of state.symbols) {
            const newsResult = await this.mcpManager.executeTool('news', 'get_financial_news', { symbols: [symbol] });

            if (newsResult.content && Array.isArray(newsResult.content)) {
              const textContent = newsResult.content.find(item => item.type === 'text');
              if (textContent?.text) {
                try {
                  const symbolNews = JSON.parse(textContent.text);
                  if (Array.isArray(symbolNews)) {
                    newsContext = newsContext.concat(symbolNews);
                  } else if (typeof symbolNews === 'object') {
                    newsContext.push(symbolNews);
                  }
                } catch (parseError) {
                  console.warn(`Failed to parse news data for ${symbol}:`, parseError);
                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to fetch news context:', error);
        }
      }

      marketContext = this.analyzer.generateMarketContext(state.symbols, newsContext);

      return {
        newsContext,
        marketContext,
        messages: [...state.messages, new AIMessage(`${state.symbols.length}シンボルの市場コンテキストを収集しました`)]
      };
    } catch (error) {
      console.warn('Context gathering failed, continuing without context:', error);
      return {
        marketContext: 'Limited market context available',
        newsContext: []
      };
    }
  }

  private async planExecution(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    const { query, symbols, marketContext } = state;

    try {
      const availableToolNames = this.mcpManager.getAvailableTools();
      
      const parser = StructuredOutputParser.fromZodSchema(ExecutionPlanSchema);
      const formatInstructions = parser.getFormatInstructions();

      const toolsList = availableToolNames.map(tool => {
        return `- ${tool}: データ取得`;
      }).join('\n');

      const mappingList = Object.entries(SYMBOL_MAPPING)
        .map(([key, value]) => `${key} -> ${value}`)
        .join('\n');

      const promptTemplate = createPlanPrompt(formatInstructions);
      const formattedPrompt = await promptTemplate.format({
        query,
        symbols: symbols.join(', '),
        marketContext,
        tools: toolsList,
        mapping: mappingList,
        formatInstructions
      });

      const response = await this.ollama.chat({
        model: this.config.defaultModel || 'llama3.2',
        messages: [
          { role: 'system', content: 'あなたはJSON形式の応答のみを返すアシスタントです。説明や追加のテキストは含めないでください。' },
          { role: 'user', content: formattedPrompt }
        ],
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 1200
        }
      });

      let executionPlan: ExecutionPlan;
      
      try {
        const parsedContent = await parser.parse(response.message.content);
        console.log('Raw plan response:', parsedContent);
        
        const defaultPlan = {
          steps: [],
          analysisType: 'comprehensive' as const,
          priority: 3
        };
        
        executionPlan = {
          ...defaultPlan,
          ...parsedContent,
          steps: (parsedContent.steps || []).map((step: any) => {
            if (step.toolName === 'search_news') {
              return {
                id: step.id || '',
                toolName: step.toolName || '',
                parameters: {
                  query: `${step.targetSymbol} cryptocurrency news`,
                  ...step.parameters
                },
                description: step.description || '',
                completed: step.completed || false,
                mcpServer: step.mcpServer,
                targetSymbol: step.targetSymbol || ''
              };
            }
            return {
              id: step.id || '',
              toolName: step.toolName || '',
              parameters: step.parameters || {},
              description: step.description || '',
              completed: step.completed || false,
              mcpServer: step.mcpServer,
              targetSymbol: step.targetSymbol || ''
            };
          })
        };
        
        executionPlan = ExecutionPlanSchema.parse(executionPlan);
      } catch (parseError) {
        console.warn('Plan parsing failed, using fallback:', parseError);
        throw parseError;
      }
      
      return {
        executionPlan,
        messages: [...state.messages, new AIMessage(`${executionPlan.steps.length}ステップの実行計画を生成しました`)]
      };
    } catch (error) {
      console.warn('Planning failed, using enhanced fallback plan:', error);
      
      const fallbackSteps: ExecutionStep[] = [];
      
      symbols.forEach((symbol, index) => {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        
        fallbackSteps.push(
          {
            id: `price_${symbol}_${index}`,
            toolName: 'get_crypto_price',
            parameters: { symbol: normalizedSymbol },
            description: `${symbol}の価格データを取得`,
            completed: false,
            mcpServer: 'crypto',
            targetSymbol: symbol
          },
          {
            id: `market_${symbol}_${index}`,
            toolName: 'get_market_data',
            parameters: { symbol: normalizedSymbol },
            description: `${symbol}の市場データを取得`,
            completed: false,
            mcpServer: 'crypto',
            targetSymbol: symbol
          },
          {
            id: `news_${symbol}_${index}`,
            toolName: 'search_news',
            parameters: { query: `${symbol} cryptocurrency news` },
            description: `${symbol}のニュースを検索`,
            completed: false,
            mcpServer: 'news',
            targetSymbol: symbol
          }
        );
      });

      const fallbackPlan: ExecutionPlan = {
        steps: fallbackSteps,
        analysisType: 'comprehensive',
        priority: 3
      };

      return {
        executionPlan: fallbackPlan,
        messages: [...state.messages, new AIMessage(`${symbols.length}シンボルのフォールバック実行計画を使用します`)]
      };
    }
  }

  private async executeStep(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    const { executionPlan, currentStep } = state;
    
    if (currentStep >= executionPlan.steps.length) {
      return { currentStep };
    }

    const step = executionPlan.steps[currentStep];
    
    try {
      const serverName = step.mcpServer || 'crypto';
      const normalizedSymbol = this.normalizeSymbol(step.targetSymbol);
      
      let parameters: Record<string, any>;
      if (step.toolName === 'search_news') {
        parameters = {
          query: `${step.targetSymbol} cryptocurrency news`,
          symbol: step.targetSymbol
        };
      } else {
        parameters = {
          ...step.parameters,
          symbol: normalizedSymbol
        };
      }

      console.log(`Executing ${step.toolName} for ${step.targetSymbol} (normalized: ${normalizedSymbol}) on ${serverName} server with params:`, parameters);

      const toolResult = await this.mcpManager.executeTool(serverName, step.toolName, parameters);

      const updatedSteps = [...executionPlan.steps];
      updatedSteps[currentStep] = {
        ...step,
        completed: true,
        result: toolResult.content
      };

      console.log(`Step completed for ${step.targetSymbol}:`, {
        stepId: step.id,
        toolName: step.toolName,
        targetSymbol: step.targetSymbol,
        normalizedSymbol,
        hasResult: !!toolResult.content
      });

      return {
        executionPlan: {
          ...executionPlan,
          steps: updatedSteps
        },
        currentStep: currentStep + 1
      };
    } catch (error: unknown) {
      console.error(`Step ${step.id} failed for ${step.targetSymbol}:`, error);
      
      const updatedSteps = [...executionPlan.steps];
      updatedSteps[currentStep] = {
        ...step,
        completed: true,
        result: [{ type: 'text', text: JSON.stringify({ 
          error: error instanceof Error ? error.message : String(error), 
          targetSymbol: step.targetSymbol,
          normalizedSymbol: this.normalizeSymbol(step.targetSymbol)
        })}]
      };

      return {
        executionPlan: {
          ...executionPlan,
          steps: updatedSteps
        },
        currentStep: currentStep + 1
      };
    }
  }

  private async analyzeData(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    const { executionPlan, currentStep, marketContext, newsContext } = state;
    const completedStep = executionPlan.steps[currentStep - 1];
    
    if (!completedStep || !completedStep.result) {
      return {};
    }

    try {
      const data = this.parseStepResult(completedStep.result);
      
      if (!data || Object.keys(data).length === 0) {
        console.warn(`No data parsed for step ${completedStep.id} (${completedStep.targetSymbol})`);
        return {};
      }

      const analysis = await this.analyzer.performComprehensiveAnalysis(
        data, 
        completedStep.toolName,
        completedStep.targetSymbol,
        marketContext,
        newsContext
      );
      
      if (analysis) {
        console.log(`Analysis completed for ${completedStep.targetSymbol}:`, {
          symbol: analysis.symbol,
          recommendation: analysis.recommendation,
          confidence: analysis.confidence
        });
        
        return {
          analysisResults: [...state.analysisResults, analysis]
        };
      }

      return {};
    } catch (error) {
      console.error(`Data analysis failed for ${completedStep.targetSymbol}:`, error);
      return {};
    }
  }

  private async synthesizeResults(state: CryptoAnalysisState): Promise<Partial<CryptoAnalysisState>> {
    const { analysisResults, query, marketContext, newsContext } = state;
    
    try {
      const finalSummary = await this.analyzer.synthesizeResults(
        analysisResults,
        query,
        marketContext,
        newsContext
      );

      console.log('Final synthesis completed:', {
        sentiment: finalSummary.overallSentiment,
        confidence: finalSummary.confidenceScore,
        findings: finalSummary.keyFindings.length
      });

      return {
        finalSummary,
        messages: [...state.messages, new AIMessage(`${analysisResults.length}銘柄の包括的分析が完了しました`)]
      };
    } catch (error) {
      console.error('Result synthesis failed:', error);
      
      const fallbackSummary: AnalysisSummary = {
        overallSentiment: 'neutral',
        keyFindings: analysisResults.map(a => `${a.symbol}: ${a.recommendation}`),
        recommendations: ['詳細な分析は失敗しましたが、個別の推奨事項を参照してください'],
        summary: `${analysisResults.length}銘柄の分析を実行しましたが、統合処理でエラーが発生しました。個別の分析結果を確認してください。`,
        confidenceScore: 0.5
      };

      return {
        finalSummary: fallbackSummary,
        error: `Result synthesis failed: ${error}`
      };
    }
  }

  private shouldContinueExecution(state: CryptoAnalysisState): string {
    const { executionPlan, currentStep } = state;
    
    if (currentStep >= executionPlan.steps.length) {
      return 'done';
    }
    
    const currentStepInfo = executionPlan.steps[currentStep - 1];
    if (currentStepInfo && currentStepInfo.completed) {
      return 'continue';
    }
    
    return 'next_step';
  }

  private parseStepResult(result: any): any {
    try {
      if (Array.isArray(result)) {
        const textContent = result.find(item => item.type === 'text');
        if (textContent?.text) {
          try {
            return JSON.parse(textContent.text);
          } catch (parseError) {
            console.warn('Failed to parse JSON from text content:', textContent.text);
            return {
              error: textContent.text,
              timestamp: new Date().toISOString()
            };
          }
        }
      }
      return result;
    } catch (error) {
      console.warn('Failed to parse step result:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  public async analyzeQuery(query: string): Promise<{
    success: boolean;
    results: CryptoAnalysis[];
    summary: AnalysisSummary;
    error?: string;
  }> {
    try {
      console.log('Starting analysis for query:', query);
      
      const initialState: CryptoAnalysisState = {
        messages: [],
        query,
        symbols: [],
        analysisResults: [],
        executionPlan: { steps: [], analysisType: 'comprehensive', priority: 3 },
        currentStep: 0,
        finalSummary: {
          overallSentiment: 'neutral',
          keyFindings: [],
          recommendations: [],
          summary: '',
          confidenceScore: 0.5
        },
        marketContext: '',
        newsContext: []
      };

      const result = await this.graph.invoke(initialState);

      console.log('Analysis completed:', {
        resultsCount: result.analysisResults.length,
        hasError: !!result.error,
        sentiment: result.finalSummary.overallSentiment
      });

      return {
        success: !result.error,
        results: result.analysisResults,
        summary: result.finalSummary,
        error: result.error
      };
    } catch (error: unknown) {
      console.error('Analysis failed:', error);
      return {
        success: false,
        results: [],
        summary: {
          overallSentiment: 'neutral',
          keyFindings: [],
          recommendations: [],
          summary: 'Analysis failed due to system error',
          confidenceScore: 0
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  public async cleanup(): Promise<void> {
    await this.mcpManager.cleanup();
  }

  public async healthCheck(): Promise<{
    ollama: boolean;
    mcpServers: Record<string, boolean>;
    tools: number;
  }> {
    let ollamaHealthy = false;
    try {
      await this.ollama.list();
      ollamaHealthy = true;
    } catch {
      // Ollama not available
    }

    const mcpHealth = await this.mcpManager.healthCheck();

    return {
      ollama: ollamaHealthy,
      ...mcpHealth
    };
  }
}