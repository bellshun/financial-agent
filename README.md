## プロジェクト概要
公開APIから暗号通貨や株価、ニュースデータを取得して、今後の変動を予測するツールです。
MCP,LangGraphのStateGraphを触ってみて理解するために作りました。

![MCP構成図イメージ](./docs/image.png)

## 実装ファイル
- MCPサーバー：
    1. [暗号通貨データMCPサーバー](./src/mcp/crypto-server.ts)
        Tool：get_crypto_price, get_market_data
    2. [ニュースデータMCPサーバー](./src/mcp/news-server.ts)
        Tool: get_financial_news, search_news
    3. [株価データMCPサーバー](./src/mcp/stock-server.ts)
        Tool: get_stock_quote, get_technical_indicates
- MCPクライアント：[./src/mcp-client.ts](./src/mcp-client.ts)
- LangGraphワークフロー：[./src/workflow.ts](./src/workflow.ts)
    1. 初期化
    2. MCPで「必要な処理の計画」を生成
    3. LangGraphがその出力に従ってFunctionを1つずつ呼ぶ
    4. 出力の生成と保存
- プロンプト：[./src/prompt.ts](./src/prompts.ts)
- メイン実行:[./src/cli-runner.ts](./src/cli-runner.ts)

## 利用技術
- LangGraph：https://github.com/langchain-ai/langgraphjs
- MCP：https://github.com/modelcontextprotocol/typescript-sdk
- モデル(llama3.2)：https://github.com/ollama/ollama

## 実行方法

### 1. セットアップ
```bash
npm install
```

### 2. MCPサーバー起動
```bash
npm run start-mcp-servers
```

### 3. 分析実行
CLIから指示を投げて分析できるようにしたいです。
例えば以下のような例です。以下のようなことが実現できるようにしたいです。
```bash
npm run analyze "今注目されてる暗号通貨の価格を確認して、上昇トレンドならニュースも読んで要約して"
```