#!/usr/bin/env tsx
import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

interface MCPServer {
  name: string;
  script: string;
  process?: ChildProcess;
}

const servers: MCPServer[] = [
  {
    name: 'Stock MCP Server',
    script: path.join(srcDir, 'mcp', 'stock-server.ts')
  },
  {
    name: 'Crypto MCP Server', 
    script: path.join(srcDir, 'mcp', 'crypto-server.ts')
  },
  {
    name: 'News MCP Server',
    script: path.join(srcDir, 'mcp', 'news-server.ts')
  }
];

async function startMCPServers() {
  console.log(chalk.blue('🚀 Starting MCP Servers...'));
  console.log(chalk.gray('Press Ctrl+C to stop all servers\n'));
  
  // 各サーバーを起動
  for (const server of servers) {
    try {
      console.log(chalk.yellow(`Starting ${server.name}...`));
      
      server.process = spawn('tsx', [server.script], {
        stdio: 'inherit',  // 標準入出力を継承
        env: { ...process.env }
      });
      
      server.process.on('exit', (code) => {
        console.log(chalk.gray(`[${server.name}] Exited with code ${code}`));
      });
      
      console.log(chalk.green(`✅ ${server.name} started (PID: ${server.process.pid})`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to start ${server.name}:`), error);
    }
  }
  
  console.log(chalk.blue('\n🎯 All MCP servers started!'));
  console.log(chalk.gray('Servers are running in background. Use Ctrl+C to stop all.\n'));
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down MCP servers...'));
    
    servers.forEach(server => {
      if (server.process) {
        server.process.kill('SIGTERM');
        console.log(chalk.gray(`Stopped ${server.name}`));
      }
    });
    
    console.log(chalk.blue('👋 All servers stopped. Goodbye!'));
    process.exit(0);
  });
  
  // Keep the process alive
  setInterval(() => {
    // Check if any server has died
    servers.forEach(server => {
      if (server.process && server.process.killed) {
        console.log(chalk.red(`⚠️  ${server.name} has stopped unexpectedly`));
      }
    });
  }, 5000);
}

startMCPServers().catch(error => {
  console.error(chalk.red('❌ Failed to start MCP servers:'), error);
  process.exit(1);
});