/**
 * Centralized logging system for CreateSuite
 * Replaces console.log statements with proper structured logging
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private context: string;
  private logLevel: LogLevel;

  constructor(context: string = 'CreateSuite') {
    this.context = context;
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      case 'trace': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, metadata?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const levelIcon = this.getLevelIcon(level);
    
    if (process.env.NODE_ENV === 'development') {
      // Colorful development output
      const colorCode = this.getLevelColor(level);
      let formatted = `${colorCode}${levelIcon} ${level.toUpperCase()} [${this.context}] ${message}\x1b[0m`;
      
      if (metadata && Object.keys(metadata).length > 0) {
        formatted += `\n  ${JSON.stringify(metadata, null, 2)}`;
      }
      
      return formatted;
    } else {
      // Structured JSON for production
      const logEntry: LogEntry = {
        timestamp,
        level,
        message,
        context: this.context,
        ...(metadata && { metadata })
      };
      
      return JSON.stringify(logEntry);
    }
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return '📘';
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.TRACE: return '🔬';
      default: return '📝';
    }
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.WARN: return '\x1b[33m'; // Yellow
      case LogLevel.INFO: return '\x1b[36m'; // Cyan
      case LogLevel.DEBUG: return '\x1b[35m'; // Magenta
      case LogLevel.TRACE: return '\x1b[90m'; // Gray
      default: return '\x1b[0m'; // Default
    }
  }

  error(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, metadata));
    }
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, metadata));
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, metadata));
    }
  }

  trace(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.log(this.formatMessage(LogLevel.TRACE, message, metadata));
    }
  }

  /**
   * Log OAuth flow events (replaces console.log in OAuth manager)
   */
  oauth(message: string, metadata?: Record<string, any>): void {
    this.info(`🔐 OAuth: ${message}`, metadata);
  }

  /**
   * Log task management events
   */
  task(message: string, metadata?: Record<string, any>): void {
    this.info(`📋 Task: ${message}`, metadata);
  }

  /**
   * Log agent lifecycle events
   */
  agent(message: string, metadata?: Record<string, any>): void {
    this.info(`🤖 Agent: ${message}`, metadata);
  }

  /**
   * Log provider management events
   */
  provider(message: string, metadata?: Record<string, any>): void {
    this.info(`🔌 Provider: ${message}`, metadata);
  }
}

// Global logger instance
export const logger = new Logger('CreateSuite');

// Context-specific loggers
export const oauthLogger = new Logger('OAuth');
export const taskLogger = new Logger('TaskManager');
export const agentLogger = new Logger('AgentOrchestrator');
export const providerLogger = new Logger('ProviderManager');