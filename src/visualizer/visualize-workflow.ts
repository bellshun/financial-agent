import { IntegratedCryptoAnalyzer } from '../workflow/workflow';
import * as graphviz from 'graphviz';
import { StateGraph } from '@langchain/langgraph';
import path from 'path';
import fs from 'fs';

/**
 * workflow.tsで実装しているStateGraphのworkflowを可視化するために同じものを定義
 */
class WorkflowVisualizer {
  static async visualizeGraph(graph: StateGraph<any>, outputPath: string = 'workflow.png'): Promise<void> {
    const g = graphviz.digraph('Workflow');
    
    // ノードの追加
    g.addNode('START', { shape: 'circle' });
    g.addNode('END', { shape: 'circle' });
    
    // 各ノードの追加
    const nodes = ['parse_query', 'gather_context', 'plan_execution', 'execute_step', 'analyze_data', 'synthesize_results'];
    nodes.forEach(node => {
      g.addNode(node, { shape: 'box' });
    });

    // エッジの追加
    g.addEdge('START', 'parse_query');
    g.addEdge('parse_query', 'gather_context');
    g.addEdge('gather_context', 'plan_execution');
    g.addEdge('plan_execution', 'execute_step');
    g.addEdge('execute_step', 'analyze_data', { label: 'continue' });
    g.addEdge('execute_step', 'execute_step', { label: 'next_step' });
    g.addEdge('execute_step', 'synthesize_results', { label: 'done' });
    g.addEdge('analyze_data', 'execute_step');
    g.addEdge('synthesize_results', 'END');

    // グラフの出力
    await g.output('png', outputPath);
  }
}

/**
 * workflow可視化処理
 */
async function main() {
  try {
    // 出力ディレクトリの作成
    const outputDir = path.join(process.cwd(), 'src', 'visualize', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'workflow.png');

    // ワークフローのインスタンス化
    const workflow = new IntegratedCryptoAnalyzer();
    
    // グラフの可視化
    console.log('グラフの可視化を開始します...');
    await WorkflowVisualizer.visualizeGraph(workflow.getGraph(), outputPath);
    console.log(`グラフの可視化が完了しました: ${outputPath}`);

  } catch (error) {
    console.error('グラフの可視化中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main(); 