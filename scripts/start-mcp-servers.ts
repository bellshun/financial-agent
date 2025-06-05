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

/**
 * launch multiple MCP servers locally and simultaneously
 */
async function startMCPServers() {
  console.log(chalk.blue('Starting MCP Servers...'));
  console.log(chalk.gray('Press Ctrl+C to stop all servers\n'));
  
  for (const server of servers) {
    try {
      console.log(chalk.yellow(`Starting ${server.name}...`));
      
      server.process = spawn('tsx', [server.script], {
        stdio: 'inherit',  // Inherits standard I/O
        env: { ...process.env }
      });
            
      console.log(chalk.green(`${server.name} started (PID: ${server.process.pid})`));
      
    } catch (error) {
      console.error(chalk.red(`Failed to start ${server.name}:`), error);
    }
  }
  
  console.log(chalk.blue('\nAll MCP servers started!'));
  console.log(chalk.gray('Servers are running in background. Use Ctrl+C to stop all.\n'));
    
  // Keep the process alive (health check)
  setInterval(() => {
    // Check if any server has died
    servers.forEach(server => {
      if (server.process && server.process.killed) {
        console.log(chalk.red(` ${server.name} has stopped unexpectedly`));
      }
    });
  }, 5000);
}

startMCPServers().catch(error => {
  console.error(chalk.red('Failed to start MCP servers:'), error);
  process.exit(1);
});