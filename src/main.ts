import { Command } from 'commander';
import { AnalysisWorkflow } from './graph/workflow.js';
import { createMemoryStore } from './memory/sqlite-memory.js';
import { AnalysisSession } from './memory/types.js';
import { MCPClientManager } from './clients/mcp-client-manager.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

// 環境変数の読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const program = new Command();

// 共通のワークフロー初期化関数
async function initializeWorkflowWithManager() {
  console.log(chalk.blue('🔄 Initializing analysis system...'));
  
  const memoryStore = createMemoryStore();
  await memoryStore.initialize();
  console.log(chalk.green('✅ Memory store initialized'));

  const mcpManager = new MCPClientManager();
  console.log(chalk.blue('🔌 Connecting to MCP servers...'));
  
  // MCPクライアントの接続処理
  try {
    await mcpManager.connectAll();
    const health = await mcpManager.healthCheck();
    
    const healthyServers = Object.entries(health).filter(([_, isHealthy]) => isHealthy);
    const unhealthyServers = Object.entries(health).filter(([_, isHealthy]) => !isHealthy);
    
    console.log(chalk.green(`✅ Connected servers: ${healthyServers.map(([name]) => name).join(', ')}`));
    if (unhealthyServers.length > 0) {
      console.log(chalk.yellow(`⚠️  Unhealthy servers: ${unhealthyServers.map(([name]) => name).join(', ')}`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to connect to MCP servers:'), error);
    await memoryStore.close();
    throw error;
  }

  const workflow = new AnalysisWorkflow(memoryStore, mcpManager);
  await workflow.initialize();
  console.log(chalk.green('✅ Analysis workflow ready'));
  
  return { memoryStore, mcpManager, workflow };
}

// 共通のクリーンアップ関数
async function cleanup(memoryStore: any, workflow?: any) {
  console.log(chalk.blue('🧹 Cleaning up resources...'));
  
  if (workflow) {
    try {
      await workflow.cleanup();
      console.log(chalk.gray('✅ Workflow cleaned up'));
    } catch (error) {
      console.error(chalk.red('❌ Workflow cleanup error:'), error);
    }
  }
  
  if (memoryStore) {
    try {
      await memoryStore.close();
      console.log(chalk.gray('✅ Memory store closed'));
    } catch (error) {
      console.error(chalk.red('❌ Memory store cleanup error:'), error);
    }
  }
}

program
  .name('financial-agent')
  .description('Multi-agent financial analysis system')
  .version('1.0.0');

// CLI処理
program
  .command('analyze')
  .description('Analyze stocks and cryptocurrencies')
  .option('-s, --symbols <symbols>', 'Comma-separated list of symbols', 'AAPL,MSFT,bitcoin,ethereum')
  .option('-q, --query <query>', 'Analysis query', 'Provide investment analysis')
  .option('--health-check', 'Perform health check before analysis', false)
  .action(async (options) => {
    let memoryStore, workflow;
    
    try {
      // システム初期化
      const components = await initializeWorkflowWithManager();
      memoryStore = components.memoryStore;
      workflow = components.workflow;
      
      // オプション: 健全性チェック
      if (options.healthCheck) {
        console.log(chalk.blue('🏥 Performing detailed health check...'));
        const health = await workflow.healthCheck();
        console.log('Health status:', health);
        
        const unhealthyClients = Object.entries(health).filter(([_, isHealthy]) => !isHealthy);
        if (unhealthyClients.length > 0) {
          console.log(chalk.yellow(`⚠️  Warning: ${unhealthyClients.length} clients are unhealthy`));
          console.log('Continuing with available clients...');
        }
      }

      const compiledWorkflow = workflow.createWorkflow();

      const initialState = {
        query: options.query,
        symbols: options.symbols.split(',').map((s: string) => s.trim()),
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),
        analyses: {},
        agentStatus: {
          stock: 'pending',
          crypto: 'pending',
          news: 'pending'
        },
        errors: []
      };

      console.log(chalk.blue("🚀 Starting multi-agent analysis..."));
      console.log(chalk.cyan(`📊 Analyzing: ${initialState.symbols.join(', ')}`));
      console.log(chalk.cyan(`❓ Query: ${initialState.query}`));
      console.log(chalk.gray("─".repeat(50)));

      // 進行状況表示の改善
      const analysisPromise = compiledWorkflow.invoke(initialState);
      
      // タイムアウト処理（オプション）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Analysis timeout after 5 minutes'));
        }, 5 * 60 * 1000); // 5分タイムアウト
      });

      console.log(chalk.blue('⏳ Analysis in progress...'));
      const result = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log(chalk.green('✅ Analysis completed'));
      console.log('Debug - Result structure:', Object.keys(result));
      
      // 結果の検証
      if (!result.finalResult && !result.analyses) {
        console.log(chalk.yellow('⚠️  Warning: Analysis completed but no results found'));
        console.log('Debug - Full result:', JSON.stringify(result, null, 2));
      }

      // メモリに保存
      const session: AnalysisSession = {
        sessionId: initialState.sessionId,
        timestamp: initialState.timestamp,
        query: initialState.query,
        symbols: initialState.symbols,
        finalReport: result.finalResult ? {
          summary: result.finalResult.summary || 'Analysis completed',
          recommendations: result.finalResult.recommendations || [],
          confidence: result.finalResult.confidence || 0
        } : null
      };
      
      console.log(chalk.blue('💾 Saving session to memory...'));
      await memoryStore.saveState(session);
      console.log(chalk.green('✅ Session saved'));
      
      // 結果表示の改善
      console.log("\n" + chalk.bold("=".repeat(50)));
      console.log(chalk.bold.blue("📋 FINAL ANALYSIS REPORT"));
      console.log(chalk.bold("=".repeat(50)));
      
      if (result.finalResult) {
        console.log(chalk.bold("\n📝 Summary:"));
        console.log(result.finalResult.summary || 'No summary available');
        
        if (result.finalResult.recommendations && result.finalResult.recommendations.length > 0) {
          console.log(chalk.bold("\n💡 Recommendations:"));
          result.finalResult.recommendations.forEach((rec: any, i: number) => {
            console.log(`${i + 1}. ${chalk.cyan(rec.symbol || 'N/A')}: ${chalk.yellow(rec.action || rec.recommendation)} - ${rec.reason || rec.reasoning}`);
          });
        }
        
        if (result.finalResult.confidence !== undefined) {
          console.log(chalk.bold(`\n🎯 Overall Confidence: ${chalk.green(result.finalResult.confidence)}%`));
        }
      } else {
        console.log(chalk.yellow("\n⚠️  No final report generated"));
        
        // 個別分析結果を表示
        if (result.analyses) {
          console.log(chalk.bold("\n📊 Individual Analysis Results:"));
          Object.entries(result.analyses).forEach(([type, analysis]: [string, any]) => {
            console.log(`\n${chalk.cyan(type.toUpperCase())} Analysis:`);
            if (analysis.error) {
              console.log(chalk.red(`  ❌ Error: ${analysis.error}`));
            } else {
              console.log(`  ✅ Status: Completed`);
              // 分析結果の詳細表示（可能な場合）
              if (analysis.summary) {
                console.log(`  📝 Summary: ${analysis.summary}`);
              }
            }
          });
        }
      }
      
      // セッション情報を表示
      console.log(chalk.gray(`\n🔍 Session ID: ${initialState.sessionId}`));
      console.log(chalk.gray(`📅 Timestamp: ${initialState.timestamp}`));
      
      // クライアント状態を表示
      const clientStatus = workflow.getClientStatus();
      console.log(chalk.gray(`🔌 Active connections: ${clientStatus.join(', ')}`));
      
    } catch (error) {
      console.error(chalk.red("❌ Analysis failed:"), error);
      
      // エラーの詳細情報
      if ((error as Error).stack) {
        console.error(chalk.gray("Stack trace:"), (error as Error).stack);
      }
      
      process.exit(1);
    } finally {
      await cleanup(memoryStore, workflow);
    }
  });

program
  .command('health')
  .description('Check system health')
  .action(async () => {
    let memoryStore, workflow;
    
    try {
      const components = await initializeWorkflowWithManager();
      memoryStore = components.memoryStore;
      workflow = components.workflow;
      
      console.log(chalk.blue('🏥 Performing comprehensive health check...'));
      
      const health = await workflow.healthCheck();
      const clientStatus = workflow.getClientStatus();
      
      console.log(chalk.bold('\n📊 System Health Report'));
      console.log(chalk.gray('─'.repeat(30)));
      
      console.log(chalk.bold('\n🔌 MCP Connections:'));
      Object.entries(health).forEach(([server, isHealthy]) => {
        const status = isHealthy ? chalk.green('✅ Healthy') : chalk.red('❌ Unhealthy');
        console.log(`  ${server}: ${status}`);
      });
      
      console.log(chalk.bold('\n📈 Statistics:'));
      const totalServers = Object.keys(health).length;
      const healthyServers = Object.values(health).filter(Boolean).length;
      console.log(`  Total servers: ${totalServers}`);
      console.log(`  Healthy servers: ${chalk.green(healthyServers)}`);
      console.log(`  Unhealthy servers: ${chalk.red(totalServers - healthyServers)}`);
      console.log(`  Health percentage: ${chalk.cyan(Math.round((healthyServers / totalServers) * 100))}%`);
      
      if (healthyServers === totalServers) {
        console.log(chalk.green('\n🎉 All systems operational!'));
      } else if (healthyServers > 0) {
        console.log(chalk.yellow('\n⚠️  Some systems have issues but analysis can continue'));
      } else {
        console.log(chalk.red('\n🚨 Critical: No healthy connections available'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), error);
      process.exit(1);
    } finally {
      await cleanup(memoryStore, workflow);
    }
  });

// 既存のhistory, session, cleanコマンドも改善...
program
  .command('history')
  .description('Show recent analysis history')
  .option('-l, --limit <limit>', 'Number of sessions to show', '5')
  .action(async (options) => {
    const memoryStore = createMemoryStore();
    
    try {
      await memoryStore.initialize();
      const sessions = await memoryStore.getRecentSessions(parseInt(options.limit));
      
      console.log(chalk.bold("📚 Recent Analysis Sessions:"));
      console.log(chalk.gray("─".repeat(50)));
      
      if (sessions.length === 0) {
        console.log(chalk.yellow("No analysis sessions found."));
        return;
      }
      
      sessions.forEach((session, i) => {
        console.log(`${chalk.cyan(i + 1)}. ${chalk.white(session.timestamp)}`);
        console.log(`   ${chalk.gray('Session ID:')} ${session.sessionId}`);
        console.log(`   ${chalk.gray('Query:')} ${session.query}`);
        console.log(`   ${chalk.gray('Symbols:')} ${session.symbols.join(', ')}`);
        if (session.finalReport) {
          console.log(`   ${chalk.gray('Confidence:')} ${chalk.green(session.finalReport.confidence)}%`);
        }
        console.log();
      });
    } catch (error) {
      console.error(chalk.red("❌ Failed to retrieve history:"), error);
      process.exit(1);
    } finally {
      await memoryStore.close();
    }
  });

// エラーハンドリングの改善
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Received SIGINT, shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down gracefully...'));
  process.exit(0);
});

program.parse();