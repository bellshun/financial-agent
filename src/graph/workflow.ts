import { StateGraph } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState } from "./state";
import { StockAgent } from "./agents/stock-agent";
import { CryptoAgent } from "./agents/crypt-agent";
import { NewsAgent } from "./agents/news-agent";
import { Coordinator } from "./agents/coordinator";
import { MCPClientManager } from "../clients/mcp-client-manager";
import { MemoryStore } from "../memory/types";

export class AnalysisWorkflow {
  private stockAgent: StockAgent | undefined;
  private cryptoAgent: CryptoAgent | undefined;
  private newsAgent: NewsAgent | undefined;
  private coordinator: Coordinator | undefined;
  private memoryStore: MemoryStore;
  private mcpManager: MCPClientManager;

  constructor(memoryStore: MemoryStore, mcpManager?: MCPClientManager) {
    this.memoryStore = memoryStore;
    this.mcpManager = mcpManager || new MCPClientManager();    
  }

  /**
   * 各エージェントの非同期初期化
   */
  async initialize(): Promise<void> {
    try {
      // 必要なMCPクライアントを取得
      const stockClient = await this.mcpManager.getClient('stock-mcp-server');
      const cryptoClient = await this.mcpManager.getClient('crypto-mcp-server');
      const newsClient = await this.mcpManager.getClient('news-mcp-server');

      // 各エージェントを初期化
      this.stockAgent = new StockAgent(stockClient);
      this.cryptoAgent = new CryptoAgent(cryptoClient);
      this.newsAgent = new NewsAgent(newsClient);
      this.coordinator = new Coordinator(this.memoryStore);

      console.log('✅ Analysis Workflow initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Analysis Workflow:', error);
      throw error;
    }
  }

  // ワークフロー作成前に初期化チェック
  private ensureInitialized(): void {
    if (!this.stockAgent || !this.cryptoAgent || !this.newsAgent || !this.coordinator) {
      throw new Error('Workflow not initialized. Call initialize() first.');
    }
  }

  createWorkflow() {
    this.ensureInitialized();
    
    const workflow = new StateGraph(AgentStateAnnotation)
    
    // エージェントノードを追加
    .addNode("stock_analysis", async (state: AgentState) => {
      try {
        const result = await this.stockAgent!.analyze(state);
        return result;
      } catch (error) {
        console.error('❌ Stock analysis failed:', error);
        throw new Error('failed analyses')
      }
    })
    
    .addNode("crypto_analysis", async (state: AgentState) => {
      try {
        const result = await this.cryptoAgent!.analyze(state);
        return result;
      } catch (error) {
        console.error('❌ Crypto analysis failed:', error);
        throw new Error('failed analyses')
      }
    })
    
    .addNode("news_analysis", async (state: AgentState) => {
      try {
        const result = await this.newsAgent!.analyze(state);
        return result;
      } catch (error) {
        console.error('❌ News analysis failed:', error);
        throw new Error('failed analyses')
      }
    })
    
    .addNode("coordination", async (state: AgentState) => {
      try {
        const result = await this.coordinator!.analyze(state);
        return result;
      } catch (error) {
        console.error('❌ Coordination failed:', error);
        throw new Error('failed analyses')
      }
    })
    
    // 並列実行の設定
    .addEdge("__start__", "stock_analysis")
    .addEdge("__start__", "crypto_analysis")
    .addEdge("__start__", "news_analysis")
    
    // 全ての分析が完了したら統合
    .addEdge(["stock_analysis", "crypto_analysis", "news_analysis"], "coordination")
    .addEdge("coordination", "__end__");

    return workflow.compile();
  }

  // 健全性チェック
  async healthCheck(): Promise<Record<string, boolean>> {
    return await this.mcpManager.healthCheck();
  }

  // クリーンアップ
  async cleanup(): Promise<void> {
    await this.mcpManager.disconnectAll();
  }

  // すべてのクライアントの状態を取得
  getClientStatus(): string[] {
    return this.mcpManager.getConnectedClients();
  }
}