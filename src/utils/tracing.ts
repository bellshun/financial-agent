import { Client } from "langsmith";
import { Langfuse } from "langfuse";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { RunnableConfig } from "@langchain/core/runnables";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

// LangSmithの設定
export const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_API_URL || "https://api.smith.langchain.com",
  apiKey: process.env.LANGSMITH_API_KEY || "",
});

export const langfuse = new Langfuse();

// カスタムLangSmithトレーサー
class CustomLangSmithTracer extends BaseCallbackHandler {
  name = "CustomLangSmithTracer";
  projectName: string;
  client: Client;

  constructor(config: { projectName: string; client: Client }) {
    super();
    this.projectName = config.projectName;
    this.client = config.client;
  }

  override async handleChainStart(chain: any, inputs: any, runId: string): Promise<void> {
    try {
      await this.client.createRun({
        id: runId,
        name: chain.name || "Chain",
        run_type: "chain",
        inputs,
        project_name: this.projectName,
        start_time: Date.now(),
      } as any);
    } catch (error) {
      console.error("Failed to create LangSmith run:", error);
    }
  }

  override async handleChainEnd(outputs: any, runId: string): Promise<void> {
    try {
      await this.client.updateRun(runId, {
        outputs: { output: outputs },
        end_time: Date.now(),
      } as any);
    } catch (error) {
      console.error("Failed to update LangSmith run:", error);
    }
  }

  override async handleChainError(error: any, runId: string): Promise<void> {
    try {
      await this.client.updateRun(runId, {
        error: error.message,
        end_time: Date.now(),
      } as any);
    } catch (updateError) {
      console.error("Failed to update LangSmith run with error:", updateError);
    }
  }
}

// トレーサーの設定
export const setupTracing = (projectName: string): BaseCallbackHandler[] => {
  const tracers: BaseCallbackHandler[] = [];

  // コンソールトレーサー（常に有効）
  tracers.push(new ConsoleCallbackHandler());

  // LangSmithトレーサー
  if (process.env.LANGSMITH_API_KEY) {
    tracers.push(
      new CustomLangSmithTracer({
        projectName,
        client: langsmithClient,
      })
    );
  }

  return tracers;
};

// Runnableの設定でトレーシングを有効化
export const getTracingConfig = (projectName: string): RunnableConfig => {
  const callbacks = setupTracing(projectName);
  
  return {
    callbacks,
    metadata: {
      project_name: projectName,
    },
    tags: [projectName],
  };
};

interface Trace {
  id: string;
}

// トレースの開始
export const startTrace = async (name: string, metadata?: Record<string, any>): Promise<Trace | null> => {
  if (process.env.LANGSMITH_API_KEY) {
    try {
      const runId = crypto.randomUUID();
      const run = await langsmithClient.createRun({
        id: runId,
        name,
        run_type: "chain",
        inputs: metadata || {},
        project_name: process.env.LANGSMITH_PROJECT || "default",
        start_time: Date.now(),
      } as any);
      return { id: runId };
    } catch (error) {
      console.error("Failed to start LangSmith trace:", error);
      return null;
    }
  }
  return null;
};

// トレースの終了
export const endTrace = async (runId: string | undefined, output?: any, error?: any) => {
  if (process.env.LANGSMITH_API_KEY && runId) {
    try {
      await langsmithClient.updateRun(runId, {
        outputs: output ? { output } : undefined,
        error: error ? error.message : undefined,
        end_time: Date.now(),
      } as any);
    } catch (updateError) {
      console.error("Failed to end LangSmith trace:", updateError);
    }
  }
};

// LangFuseトレースのヘルパー関数
export const createLangfuseTrace = (name: string, metadata?: Record<string, any>) => {
  return langfuse.trace({
    name,
    metadata,
  });
};

// LangFuseスパンの作成
export const createLangfuseSpan = (traceName: string, spanName: string, input?: any) => {
  const trace = createLangfuseTrace(traceName);
  if (trace) {
    return trace.span({
      name: spanName,
      input,
    });
  }
  return null;
};

// 統合トレーシング関数
export const withTracing = async <T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  // LangSmithトレース開始
  const langsmithTrace = await startTrace(name, metadata);
  
  // LangFuseトレース開始
  const langfuseTrace = createLangfuseTrace(name, metadata);
  
  try {
    const result = await fn();
    
    // 成功時のトレース終了
    if (langsmithTrace) {
      await endTrace(langsmithTrace.id, result);
    }
    
    if (langfuseTrace) {
      langfuseTrace.update({
        output: result,
      });
    }
    
    return result;
  } catch (error) {
    // エラー時のトレース終了
    if (langsmithTrace) {
      await endTrace(langsmithTrace.id, undefined, error);
    }
    
    if (langfuseTrace) {
      langfuseTrace.update({
        statusMessage: error instanceof Error ? error.message : String(error),
      } as any);
    }
    
    throw error;
  } finally {
    // LangFuseトレースの終了処理
    if (langfuseTrace) {
      await langfuse.shutdownAsync();
    }
  }
};

// LangChain Runnableでの使用例
const createTracedChain = (projectName: string) => {
  const config = getTracingConfig(projectName);
  return config;
};