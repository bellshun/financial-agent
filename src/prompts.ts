import { PromptTemplate } from '@langchain/core/prompts';

// 実行計画生成用のプロンプトテンプレート
export const planPromptTemplate = `
あなたは暗号通貨分析エキスパートです。以下のクエリに対する最適な実行計画を作成してください。

クエリ: "{query}"
対象シンボル: {symbols}
市場コンテキスト: {marketContext}

利用可能なツール:
{tools}

重要な注意点:
- クエリで指定されたシンボルのみを分析してください
- 各シンボルに対して個別のステップを作成してください
- targetSymbolフィールドで明確にシンボルを指定してください（必須）
- parametersのsymbolには正規化されたシンボル名を使用してください
- search_newsツールを使用する場合は、parametersにqueryフィールドを必ず含めてください
- 必ず全てのフィールドを含めてください

正規化マッピング:
{mapping}

{formatInstructions}`;

// 包括的分析用のプロンプトテンプレート
export const analysisPromptTemplate = `
あなたは暗号通貨分析エキスパートです。以下のデータに基づいて、{targetSymbol}の投資分析を行ってください。

価格データ:
- 現在価格: {price}
- 24時間変動: {change24h}%
{marketCap}
{volume24h}

市場コンテキスト: {marketContext}

関連ニュース ({targetSymbol}):
{relevantNews}

既存推奨: {recommendation}

以下のJSON形式で分析結果を提供してください。必ず全てのフィールドを含めてください：
{jsonSchema}`;

// 結果統合用のプロンプトテンプレート
export const synthesisPromptTemplate = `
以下の暗号通貨分析結果を統合して、包括的な投資判断を提供してください。

元のクエリ: "{query}"
市場コンテキスト: {marketContext}

分析結果:
{analysisResults}

関連ニュース:
{newsContext}

以下のJSON形式で包括的な分析を提供してください。必ず全てのフィールドを含めてください：
{jsonSchema}`;

// プロンプトテンプレートのインスタンス化
export const createPlanPrompt = (formatInstructions: string) => new PromptTemplate({
  template: planPromptTemplate,
  inputVariables: ['query', 'symbols', 'marketContext', 'tools', 'mapping', 'formatInstructions']
});

export const createAnalysisPrompt = () => new PromptTemplate({
  template: analysisPromptTemplate,
  inputVariables: ['targetSymbol', 'price', 'change24h', 'marketContext', 'relevantNews', 'marketCap', 'volume24h', 'recommendation', 'jsonSchema']
});

export const createSynthesisPrompt = () => new PromptTemplate({
  template: synthesisPromptTemplate,
  inputVariables: ['query', 'marketContext', 'analysisResults', 'newsContext', 'jsonSchema']
}); 