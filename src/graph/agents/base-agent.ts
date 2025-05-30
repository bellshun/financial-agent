import { AgentState } from '../state';
import { AgentStatusType } from '../types';
import { Logger } from '../../utils/logger';

export abstract class BaseAgent {
  protected name: string;
  protected logger: Logger;

  constructor(name: string) {
    this.name = name;
    this.logger = new Logger(name);
  }

  /**
   * エージェントの分析を実行する抽象メソッド
   */
  abstract analyze(state: AgentState): Promise<Partial<AgentState>>;

  /**
   * エージェントの状態を更新する
   */
  protected updateAgentStatus(
    state: AgentState,
    status: AgentStatusType
  ): Partial<AgentState> {
    return {
      agentStatus: {
        ...state.agentStatus,
        [this.name]: status
      }
    };
  }

  /**
   * エラーを処理し、状態を更新する
   */
  protected handleError(
    state: AgentState,
    error: unknown,
    context: string
  ): Partial<AgentState> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`${context}: ${errorMessage}`);
    
    return {
      errors: [...(state.errors || []), `${context}: ${errorMessage}`],
      agentStatus: {
        ...state.agentStatus,
        [this.name]: 'failed'
      }
    };
  }

  /**
   * エージェントの名前を取得
   */
  getName(): string {
    return this.name;
  }
} 