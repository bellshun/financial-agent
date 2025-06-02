#!/usr/bin/env node

import 'dotenv/config';
import { IntegratedCryptoAnalyzer } from './workflow';

async function main() {
  // コマンドライン引数からクエリを取得
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.log('使用方法: npm run analyze "分析したい内容"');
    console.log('例: npm run analyze "ビットコインとイーサリアムの価格を確認して投資判断して"');
    process.exit(1);
  }

  console.log(`🚀 暗号通貨分析を開始: ${query}\n`);

  try {
    const analyzer = new IntegratedCryptoAnalyzer({
      ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
    });

    await analyzer.initialize();
    await analyzer.healthCheck();

    const result = await analyzer.analyzeQuery(query);

    console.log('✅ 分析完了\n');
      
    if (result.success) {
      console.log(`Analysis successful: ${result.results.length} results`);
      console.log('Summary:', result.summary.summary);
      console.log('Overall sentiment:', result.summary.overallSentiment);
      console.log('Confidence:', result.summary.confidenceScore);
    
      result.results.forEach((analysis, index) => {
        console.log(`${index + 1}. ${analysis.symbol}: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('Analysis failed:', result.error);
    }
  } catch (error) {
    console.error('❌ 分析エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();