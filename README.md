## 概要
公開APIから暗号通貨や株価、ニュースデータを取得するAPIをMCPサーバーにしました。
クライアント(ターミナル)からLLMを呼び出して利用します。

![MCP構成図イメージ](./docs/image.png)

## 実装ファイル
- MCPサーバー：
    1. [共通処理](./src/mcp/base-mcp-server.ts)
        MCP接続処理、API実行処理などの共通クラス
    2. [暗号通貨データMCPサーバー](./src/mcp/crypto-server.ts)
        Tool：get_crypto_price, get_market_data, search_symbol
    3. [ニュースデータMCPサーバー](./src/mcp/news-server.ts)
        Tool: get_financial_news, search_news
    4. [株価データMCPサーバー](./src/mcp/stock-server.ts)
        Tool: get_stock_quote, get_technical_indicates
- MCPクライアント：[./src/mcp-client.ts](./src/mcp-client.ts)
- メインのエントリーポイント:[./src/main.ts](./src/main.ts)

## 利用技術
- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)によるMCPクライアント/サーバー実装
- [LangSmith](https://www.langchain.com/langsmith)によるトレーシング
- [ローカルLLM (Ollama)](https://github.com/ollama/ollama)によるモデル呼び出し

## 利用API
無料で利用できるAPIを利用しています。
- [CoinGecko API](https://docs.coingecko.com/v3.0.1/reference/introduction)
- [News API](https://newsapi.org/docs)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)

## 実行方法

### 1. セットアップ
```bash
npm install
```

#### Ollama
```bash
ollama run qwen3:8b
```

### 2. 環境変数設定
ローカルにMCPサーバーを立てる必要があるので、News APIとAlpha Vantage APIのAPI Keyを公式ページより取得します。
`.env.example` をコピーして `.env` を作成してください。

### 3. MCPサーバー起動
```bash
npm run start-mcp-servers
```

### 4. 実行
```bash
npm run dev
```