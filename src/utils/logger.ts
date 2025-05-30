import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { config } from './config.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}

export class Logger {
  private logLevel: LogLevel;
  private logToFile: boolean;
  private logFilePath: string;
  private context: string;

  constructor(context: string) {
    this.logLevel = config.logLevel;
    this.logToFile = config.logToFile;
    this.logFilePath = config.logFilePath;
    this.context = context;
    
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  private async ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  private async writeToFile(entry: LogEntry) {
    if (!this.logToFile) return;
    
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    
    let coloredLevel: string;
    switch (entry.level) {
      case 'debug':
        coloredLevel = chalk.gray(level);
        break;
      case 'info':
        coloredLevel = chalk.blue(level);
        break;
      case 'warn':
        coloredLevel = chalk.yellow(level);
        break;
      case 'error':
        coloredLevel = chalk.red(level);
        break;
    }
    
    let message = `${chalk.gray(timestamp)} ${coloredLevel} [${this.context}] ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      message += '\n' + chalk.gray(JSON.stringify(entry.context, null, 2));
    }
    
    return message;
  }

  private async log(level: LogLevel, message: string, context?: Record<string, unknown>, sessionId?: string) {
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(sessionId && { sessionId })
    };
    
    // コンソール出力
    console.log(this.formatConsoleMessage(entry));
    
    // ファイル出力
    await this.writeToFile(entry);
  }

  info(message: string, data?: Record<string, unknown>, sessionId?: string) {
    return this.log('info', message, data, sessionId);
  }

  warn(message: string, data?: Record<string, unknown>, sessionId?: string) {
    return this.log('warn', message, data, sessionId);
  }

  error(message: string, data?: Record<string, unknown>, sessionId?: string) {
    return this.log('error', message, data, sessionId);
  }

  debug(message: string, data?: Record<string, unknown>, sessionId?: string) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('debug', message, data, sessionId);
    }
  }

  // 分析セッション用の特別なログメソッド
  analysisStart(sessionId: string, symbols: string[], query: string) {
    return this.info('Analysis started', { symbols, query }, sessionId);
  }

  analysisComplete(sessionId: string, duration: number, success: boolean) {
    const level = success ? 'info' : 'error';
    const message = success ? 'Analysis completed' : 'Analysis failed';
    return this.log(level, message, { duration, success }, sessionId);
  }

  agentAction(sessionId: string, agent: string, action: string, data?: Record<string, unknown>) {
    return this.debug(`Agent action: ${agent} - ${action}`, data, sessionId);
  }
}

// シングルトンインスタンス
export const logger = new Logger('Main');

// 便利な関数
export function createSessionLogger(sessionId: string) {
  return new Logger(sessionId);
}