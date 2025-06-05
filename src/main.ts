import { ChatOllama } from "@langchain/ollama";
import { CompiledStateGraph } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";  
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

import * as readline from "readline";
import "dotenv/config";

const MAX_HISTORY_LENGTH = 20;

const main = async () => {
  let client: MultiServerMCPClient | null = null;
  
  try {
    // Connect with MCP server & get tools
    client = new MultiServerMCPClient({
      mcpServers: {
        crypto: { command: "tsx", args: ["./src/mcp/crypto-server.ts"] },
        news: { command: "tsx", args: ["./src/mcp/news-server.ts"] },
        stock: { command: "tsx", args: ["./src/mcp/stock-server.ts"] },
      }
    });
    const mcpTools = await client.getTools();

    const llm = new ChatOllama({
      model: "qwen3:8b", 
      baseUrl: "http://127.0.0.1:11434",
      temperature: 0.3,
    });

    // Create Agent
    const agent = createReactAgent({
      llm,
      tools: mcpTools,
      prompt: `You are an AI assistant providing stock quotes, cryptocurrency and news information.
Use the available tools to provide accurate and useful information to users' questions.

The information obtained from the tool should be properly organized and presented. Multiple tools may be used in combination.`,
    });

    await startInteractiveSession(agent);
  } catch (error) {
    console.error("initialization error:", error);
    process.exit(1);
  } finally {
    // MCP Client Cleanup
    if (client) {
      await client.close?.();
    }
  }
};

async function startInteractiveSession(
  agent: CompiledStateGraph<any, any, any, any>,
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("E.g., “Tell me the price of Bitcoin” or “Give me AAPL's stock price and 5 related news items.”");
  console.log("Type “exit” to quit.\n");

  const messages: (HumanMessage | AIMessage)[] = [];

  try {
    while (true) {
      try {
        // Accepts user input
        const userInput: string = await new Promise((resolve) => {
          rl.question("❯❯ ", (ans) => resolve(ans.trim()));
        });

        if (userInput === "exit") break;
        if (!userInput) continue;

        // Add user input to history
        messages.push(new HumanMessage(userInput));  

        console.log("Generate answers ...\n");

        // Agent Execution
        const result = await agent.invoke({ messages });

        // result
        const lastMessage = result.messages[result.messages.length - 1];  
        console.log("\n【final answer】");
        console.log(lastMessage.content);
        console.log("\n-----------------------------\n");

        // Add answer to history
        messages.push(new AIMessage(lastMessage.content));

        // If the history becomes too long, delete the old one.
        if (messages.length > MAX_HISTORY_LENGTH) {
          messages.splice(0, 2);
        }
      } catch (error: any) {
        console.error("An error occurred: ", error.message);
        console.log("\n-----------------------------\n");
      }
    }
  } finally {
    rl.close();
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unprocessed Promise Rejection:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nterminating ...');
  process.exit(0);
});

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});