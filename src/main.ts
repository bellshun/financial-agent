import { MCPClientManager, ToolMetadata } from "./mcp-client";
import { Ollama } from "ollama";
import Ajv, { ValidateFunction } from "ajv";
import * as readline from "readline";
import "dotenv/config";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// const ajv = new Ajv({ strict: false });

/**
 * JSON Schema を Ajv のバリデータ関数に変換するユーティリティ
 */
// function compileSchemaValidator(schema: any): ValidateFunction {
//   return ajv.compile(schema);
// }

/**
 * 取得した ToolMetadata[] を Markdown 形式で整形し、
 * システムプロンプトに埋め込める文字列を返す
 */
function buildToolsInfoText(tools: ToolMetadata[]): string {
  return tools
    .map((t) => {
      const schemaText =
        typeof t.inputSchema === "object"
          ? JSON.stringify(t.inputSchema, null, 2)
          : "{}";
      return [
        `- name: ${t.name}`,
        `  description: ${t.description ?? "(説明なし)"}`,
        `  inputSchema:`,
        "  ```json",
        `  ${schemaText.replace(/\n/g, "\n  ")}`,
        "  ```",
      ].join("\n");
    })
    .join("\n\n");
}

const main = async () => {
  // 1. Ollama クライアントを初期化
  const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

  // 2. MCPClientManager を初期化して各サーバーに接続し、ツール一覧を取得
  const manager = new MCPClientManager();
  await manager.initialize();
  const toolMetadatas = manager.getToolMetadata();

  // 3. システムプロンプトにツール一覧情報を埋め込む
  const toolsInfoText = buildToolsInfoText(toolMetadatas);
  const systemMessage: Message = {
    role: "system",
    content: `
あなたは株価、暗号通貨、ニュース情報を提供するAIアシスタントです。
以下のツールが利用可能です。JSON スキーマと説明を参考に、必要に応じてツールを実行してください。

${toolsInfoText}

### ツールを使いたい場合
ユーザーの要求に対してツールを呼び出す必要があると判断したら、必ず以下の JSON フォーマットで単独メッセージを返してください:
\`\`\`json
{
  "action": "use_tool",
  "tool": "<ツール名>",
  "arguments": { ... }
}
\`\`\`
JSON 以外の応答を返した時点で「最終回答」とみなします。

最終的なユーザーへの回答は、常に自然な日本語で行ってください。ツール実行後はツールの結果を優先して回答を構成してください。`.trim(),
  };

  // 4. コマンドライン入力のセットアップ
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  function promptUser(): Promise<string> {
    return new Promise((resolve) => {
      rl.question("❯❯ ", (ans) => resolve(ans.trim()));
    });
  }

  console.log("=== MCP クライアント (Ollama + qwen3:8b) 起動 ===");
  console.log("例：「BTCの価格を教えて」「AAPLの株価と関連ニュース5件ください」など。");
  console.log("終了するには exit または quit と入力。\n");

  while (true) {
    const userInput = await promptUser();
    if (userInput === "exit" || userInput === "quit") {
      console.log("終了します。");
      await manager.cleanup?.();
      rl.close();
      process.exit(0);
    }
    if (!userInput) {
      continue;
    }

    try {
      await processUserRequest(ollama, manager, systemMessage, userInput, toolMetadatas);
    } catch (error) {
      console.error("エラーが発生しました:", error);
      console.log("\n-----------------------------\n");
    }
  }
};

/**
 * 実際にユーザーリクエストを処理し、LLM → ツール → LLM の流れを回す関数
 */
const processUserRequest = async (
  ollama: Ollama,
  manager: MCPClientManager,
  systemMessage: Message,
  userInput: string,
  toolMetadatas: ToolMetadata[]
) => {
  // 会話履歴 (system + user)
  const messages: Message[] = [systemMessage, { role: "user", content: userInput }];

  let maxIterations = 5; // 無限ループ防止
  let iteration = 0;

  console.log("回答を生成します...")

  while (iteration < maxIterations) {
    iteration++;

    // ===== 1) LLM に質問を投げる =====
    const response = await ollama.chat({
      model: "qwen3:8b",
      messages: messages,
      stream: true,
    });

    let assistantMsg = "";
    console.log(`\n[AI応答 ${iteration}] `);

    // ストリーミングレスポンスを処理して一文にまとめる
    for await (const chunk of response) {
      if (chunk.message?.content) {
        process.stdout.write(chunk.message.content);
        assistantMsg += chunk.message.content;
      }
    }
    console.log(""); // 改行

    assistantMsg = assistantMsg.trim();

    // ===== 2) JSON ブロック (ツール呼び出し) を抽出 =====
    let toolCall: { action: string; tool: string; arguments: Record<string, any> } | null = null;
    try {
      // ```json { ... } ``` または生の { ... } をキャッチ
      const jsonMatch =
        assistantMsg.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
        assistantMsg.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        toolCall = JSON.parse(jsonMatch[1]);
      }
    } catch {
      toolCall = null;
    }

    // ===== 3) ツール呼び出しが指示された場合 =====
    if (toolCall?.action === "use_tool" && toolCall.tool && toolCall.arguments) {
      const toolName = toolCall.tool;
      const rawArgs = toolCall.arguments;

      console.log(`\n🔧 ツール実行: ${toolName}`);
      console.log(`   arguments: ${JSON.stringify(rawArgs, null, 2)}`);

      // 3-1) ツールメタ情報を探す
      const meta = toolMetadatas.find((t) => t.name === toolName);
      if (!meta) {
        console.log('ツールが見つかりません')
        // 見つからなければエラーメッセージを会話履歴に追加して再試行
        const errorMsg =
          `エラー: ツール "${toolName}" は存在しません。\n` +
          `利用可能なツール：\n${toolMetadatas.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`;
        messages.push({ role: "assistant", content: errorMsg });
        continue;
      }

      // 3-2) JSON スキーマでバリデーション
      // const validate = compileSchemaValidator(meta.inputSchema);
      // const valid = validate(rawArgs);
      // if (!valid) {
      //   const ajvErrors = validate.errors
      //     ?.map((e) => `・${e.instancePath} ${e.message}`)
      //     .join("\n");
      //   const errorContext =
      //     `ツール "${toolName}" の引数検証に失敗しました:\n${ajvErrors}\n再度正しい形式でリクエストしてください。`;
      //   console.error(errorContext);
      //   messages.push({ role: "assistant", content: errorContext });
      //   continue;
      // }

      // 3-3) ツール実行
      let callResult;
      try {
        callResult = await manager.executeTool(meta.server, toolName, rawArgs);
      } catch (err: any) {
        const errorContext =
          `❌ ツール "${toolName}" の実行中にエラーが発生しました: ${err.message}\n別の方法で回答してください。`;
        console.error(errorContext);
        messages.push({ role: "assistant", content: errorContext });
        continue;
      }

      // 3-4) ツール結果を会話履歴に追加して次のラウンドへ
      const toolResultStr =
        typeof callResult.content === "string"
          ? callResult.content
          : JSON.stringify(callResult.content, null, 2);
      console.log(`✅ ツール結果取得: ${toolResultStr.substring(0, 200)}...`);
      const contextMessage: Message = {
        role: "user",
        content:
          `以下はツール "${toolName}" の実行結果です。この情報を使って最終的な回答を構築してください。\n\n` +
          `${toolResultStr}`,
      };
      messages.push(contextMessage);

      // 再度 LLM を呼び出すためにループ続行
      continue;
    }

    // ===== 4) ツール呼び出しではないなら「最終回答」 =====
    console.log("\n【最終回答】");
    console.log(assistantMsg);
    console.log("\n-----------------------------\n");
    break;
  }

  if (iteration >= maxIterations) {
    console.log("⚠️ 最大反復数に達しました。処理を終了します。");
    console.log("\n-----------------------------\n");
  }
};

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
