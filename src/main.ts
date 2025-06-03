// src/main.ts
import { MCPClientManager } from "./mcp-client";
import { Ollama } from 'ollama';
import * as readline from "readline";
import 'dotenv/config';

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const main = async () => {
  const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

  const manager = new MCPClientManager();
  await manager.initialize();

  const systemMessage: Message = {
    role: "system",
    content: `あなたは株価、暗号通貨、ニュース情報を提供するAIアシスタントです。
ユーザーの要求に応じて適切な情報を取得し、分かりやすく回答してください。

利用可能な機能：
- 株価情報の取得
- 暗号通貨価格の取得  
- 関連ニュースの取得

ツールを使用する必要がある場合は、以下のJSONフォーマットで応答してください：
{
  "action": "use_tool",
  "tool": "<ツール名>",
  "arguments": { ... }
}

情報収集が完了したら、JSONではなく自然な日本語で回答してください。
データはツールの結果を優先して利用してください。`
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function promptUser(): Promise<string> {
    return new Promise((resolve) => {
      rl.question("❯❯ ", (ans) => resolve(ans.trim()));
    });
  }

  console.log("=== MCP クライアント (Ollama + llama3.2) 起動 ===");
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
      await processUserRequest(ollama, manager, systemMessage, userInput);
    } catch (error) {
      console.error("エラーが発生しました:", error);
      console.log("\n-----------------------------\n");
    }
  }
}

const processUserRequest = async (
  ollama: Ollama,
  manager: MCPClientManager,
  systemMessage: Message,
  userInput: string
) => {
  const messages: Message[] = [systemMessage];
  messages.push({ role: "user", content: userInput });

  let maxIterations = 5; // 無限ループ防止
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const response = await ollama.chat({
      model: "llama3.2",
      messages: messages,
      stream: false
    });

    const assistantMsg = response.message.content.trim();    
    console.log(`\n[AI応答 ${iteration}]`, assistantMsg);

    let toolCall: { action: string; tool: string; arguments: Record<string, any> } | null = null;
    
    try {
      // JSONブロックを抽出（```json ``` で囲まれている場合も考慮）
      const jsonMatch = assistantMsg.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                       assistantMsg.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        toolCall = JSON.parse(jsonMatch[1]);
      } else {
        toolCall = JSON.parse(assistantMsg);
      }
    } catch {
      // JSON解析失敗 = 最終回答とみなす
      toolCall = null;
    }

    // ツール呼び出しの場合
    if (toolCall?.action === "use_tool" && toolCall.tool && toolCall.arguments) {
      const toolName = toolCall.tool;
      const args = toolCall.arguments;

      console.log(`\n🔧 ツール実行: ${toolName}`, JSON.stringify(args, null, 2));

      const meta = manager["availableTools"].get(toolName);
      if (!meta) {
        const errorMsg = `エラー: ツール "${toolName}" は見つかりませんでした。\n利用可能なツール: ${Array.from(manager["availableTools"].keys()).join(", ")}`;
        messages.push({ role: "assistant", content: errorMsg });
        continue;
      }

      // ツール実行
      try {
        const callResult = await manager.executeTool(meta.server, toolName, args);
        
        const toolResultStr = typeof callResult.content === "string" 
          ? callResult.content 
          : JSON.stringify(callResult.content, null, 2);

        console.log(`✅ ツール結果取得: ${toolResultStr.substring(0, 200)}...`);

        // ツール結果をコンテキストとして追加
        const contextMessage = `以下は${toolName}ツールの実行結果です。この情報を使って回答してください：\n\n${toolResultStr}`;
        messages.push({ role: "user", content: contextMessage });

      } catch (error: any) {
        console.error(`❌ ツール実行エラー:`, error.message);
        const errorContext = `ツール "${toolName}" の実行中にエラーが発生しました: ${error.message}\n別の方法で回答してください。`;
        messages.push({ role: "user", content: errorContext });
      }

    } else {
      console.log("\n【回答】");
      console.log(assistantMsg);
      console.log("\n-----------------------------\n");
      break;
    }
  }

  if (iteration >= maxIterations) {
    console.log("⚠️ 最大反復数に達しました。処理を終了します。");
    console.log("\n-----------------------------\n");
  }
}

main();