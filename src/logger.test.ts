import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LogLevel } from '../logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset environment
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    
    logger = new Logger('TestLogger');
    
    // Spy on console methods
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Log Level Management', () => {
    it('should default to INFO log level', () => {
      logger.debug('debug message');
      logger.info('info message');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('info message')
      );
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      logger = new Logger('TestLogger');
      
      logger.debug('debug message');
      logger.trace('trace message');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('debug message')
      );
    });

    it('should filter logs below current level', () => {
      process.env.LOG_LEVEL = 'ERROR';
      logger = new Logger('TestLogger');
      
      logger.trace('trace');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(0);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(0);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Formatting', () => {
    it('should format development messages with colors and icons', () => {
      process.env.NODE_ENV = 'development';
      logger = new Logger('TestLogger');
      
      logger.info('test message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/📘.*INFO.*TestLogger.*test message/)
      );
    });

    it('should format production messages as JSON', () => {
      process.env.NODE_ENV = 'production';
      logger = new Logger('TestLogger');
      
      logger.info('test message', { key: 'value' });
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(() => JSON.parse(logCall)).not.toThrow();
      
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.context).toBe('TestLogger');
      expect(parsed.metadata).toEqual({ key: 'value' });
    });

    it('should include metadata in formatted messages', () => {
      logger.info('test message', { userId: 123, action: 'login' });
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('userId');
      expect(logCall).toContain('123');
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should format OAuth messages correctly', () => {
      logger.oauth('flow started', { clientId: 'test-client' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🔐 OAuth: flow started')
      );
    });

    it('should format task messages correctly', () => {
      logger.task('created', { taskId: 'cs-12345' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 Task: created')
      );
    });

    it('should format agent messages correctly', () => {
      logger.agent('spawned', { agentId: 'agent-001' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Agent: spawned')
      );
    });

    it('should format provider messages correctly', () => {
      logger.provider('connected', { provider: 'openai' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🔌 Provider: connected')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle circular references in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      expect(() => logger.info('message', circular)).not.toThrow();
    });

    it('should handle undefined and null metadata', () => {
      expect(() => logger.info('message', undefined)).not.toThrow();
      expect(() => logger.info('message', null as any)).not.toThrow();
    });
  });
});