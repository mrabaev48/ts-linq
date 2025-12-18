import type { SqlLogger } from '@ts-linq/types';
import { CompositeSqlLogger } from '../src/logger/CompositeSqlLogger';

describe('CompositeSqlLogger', () => {
  describe('Constructor', () => {
    it('should create logger with no delegates', () => {
      const logger = new CompositeSqlLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger with single delegate', () => {
      const mockLogger = createMockLogger();
      const logger = new CompositeSqlLogger(mockLogger);
      expect(logger).toBeDefined();
    });

    it('should create logger with multiple delegates', () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();
      const logger = new CompositeSqlLogger(logger1, logger2);
      expect(logger).toBeDefined();
    });

    it('should filter out null and undefined delegates', () => {
      const mockLogger = createMockLogger();
      const logger = new CompositeSqlLogger(mockLogger, null, undefined);
      
      logger.debug('test');
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('Log Level Delegation', () => {
    let mockLogger1: jest.Mocked<SqlLogger>;
    let mockLogger2: jest.Mocked<SqlLogger>;
    let compositeLogger: CompositeSqlLogger;

    beforeEach(() => {
      mockLogger1 = createMockLogger();
      mockLogger2 = createMockLogger();
      compositeLogger = new CompositeSqlLogger(mockLogger1, mockLogger2);
    });

    it('should delegate debug to all loggers', () => {
      compositeLogger.debug('test message', { key: 'value' });
      
      expect(mockLogger1.debug).toHaveBeenCalledWith('test message', { key: 'value' });
      expect(mockLogger2.debug).toHaveBeenCalledWith('test message', { key: 'value' });
    });

    it('should delegate info to all loggers', () => {
      compositeLogger.info('info message');
      
      expect(mockLogger1.info).toHaveBeenCalledWith('info message', undefined);
      expect(mockLogger2.info).toHaveBeenCalledWith('info message', undefined);
    });

    it('should delegate warn to all loggers', () => {
      compositeLogger.warn('warning message');
      
      expect(mockLogger1.warn).toHaveBeenCalledWith('warning message', undefined);
      expect(mockLogger2.warn).toHaveBeenCalledWith('warning message', undefined);
    });

    it('should delegate error to all loggers', () => {
      compositeLogger.error('error message');
      
      expect(mockLogger1.error).toHaveBeenCalledWith('error message', undefined);
      expect(mockLogger2.error).toHaveBeenCalledWith('error message', undefined);
    });
  });

  describe('Query Lifecycle Delegation', () => {
    let mockLogger: jest.Mocked<SqlLogger>;
    let compositeLogger: CompositeSqlLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      compositeLogger = new CompositeSqlLogger(mockLogger);
    });

    it('should delegate queryStart', () => {
      const info = { sql: 'SELECT 1', params: [], traceId: 'test' };
      compositeLogger.queryStart(info);
      
      expect(mockLogger.queryStart).toHaveBeenCalledWith(info);
    });

    it('should delegate queryEnd', () => {
      const info = { sql: 'SELECT 1', params: [], durationMs: 10, traceId: 'test' };
      compositeLogger.queryEnd(info);
      
      expect(mockLogger.queryEnd).toHaveBeenCalledWith(info);
    });

    it('should delegate retry', () => {
      const info = { sql: 'SELECT 1', params: [], attempt: 1, maxAttempts: 3, error: new Error('transient') };
      compositeLogger.retry(info);
      
      expect(mockLogger.retry).toHaveBeenCalledWith(info);
    });
  });

  describe('Transaction Delegation', () => {
    let mockLogger: jest.Mocked<SqlLogger>;
    let compositeLogger: CompositeSqlLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      compositeLogger = new CompositeSqlLogger(mockLogger);
    });

    it('should delegate transactionStart', () => {
      const info = { traceId: 'tx-1', operation: 'begin' as const };
      compositeLogger.transactionStart(info);
      
      expect(mockLogger.transactionStart).toHaveBeenCalledWith(info);
    });

    it('should delegate transactionEnd', () => {
      const info = { traceId: 'tx-1', operation: 'commit' as const };
      compositeLogger.transactionEnd(info);
      
      expect(mockLogger.transactionEnd).toHaveBeenCalledWith(info);
    });
  });

  describe('Error Handling', () => {
    it('should continue when delegate throws in debug', () => {
      const errorLogger = createMockLogger();
      const goodLogger = createMockLogger();
      errorLogger.debug.mockImplementation(() => { throw new Error('fail'); });

      const compositeLogger = new CompositeSqlLogger(errorLogger, goodLogger);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      compositeLogger.debug('test');
      
      expect(goodLogger.debug).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should continue when delegate throws in queryStart', () => {
      const errorLogger = createMockLogger();
      const goodLogger = createMockLogger();
      (errorLogger.queryStart as jest.Mock).mockImplementation(() => { throw new Error('fail'); });

      const compositeLogger = new CompositeSqlLogger(errorLogger, goodLogger);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      compositeLogger.queryStart({ sql: 'SELECT 1', params: [] });
      
      expect(goodLogger.queryStart).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Cache and Circuit Methods', () => {
    let mockLogger: jest.Mocked<SqlLogger>;
    let compositeLogger: CompositeSqlLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      compositeLogger = new CompositeSqlLogger(mockLogger);
    });

    it('should delegate cache', () => {
      const info = { cache: 'count' as const, hit: true, key: 'test-key' };
      compositeLogger.cache(info);
      
      expect(mockLogger.cache).toHaveBeenCalledWith(info);
    });

    it('should delegate circuit', () => {
      const info = { state: 'open' as const, reason: 'threshold exceeded' };
      compositeLogger.circuit(info);
      
      expect(mockLogger.circuit).toHaveBeenCalledWith(info);
    });

    it('should delegate connectionHealth', () => {
      const info = { healthy: true, latencyMs: 5 };
      compositeLogger.connectionHealth(info);
      
      expect(mockLogger.connectionHealth).toHaveBeenCalledWith(info);
    });

    it('should delegate fallback', () => {
      const info = { fallback: 'memory', attempted: true, success: true };
      compositeLogger.fallback(info);
      
      expect(mockLogger.fallback).toHaveBeenCalledWith(info);
    });
  });

  describe('Analysis Delegation', () => {
    it('should delegate analysis to all loggers', () => {
      const mockLogger = createMockLogger();
      (mockLogger as any).analysis = jest.fn();
      
      const compositeLogger = new CompositeSqlLogger(mockLogger);
      const info = { sql: 'SELECT 1', params: [], durationMs: 10, slow: false };
      
      compositeLogger.analysis(info);
      
      expect((mockLogger as any).analysis).toHaveBeenCalledWith(info);
    });
  });
});

function createMockLogger(): jest.Mocked<SqlLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    queryStart: jest.fn(),
    queryEnd: jest.fn(),
    retry: jest.fn(),
    transactionStart: jest.fn(),
    transactionEnd: jest.fn(),
    cache: jest.fn(),
    connectionHealth: jest.fn(),
    circuit: jest.fn(),
    fallback: jest.fn()
  };
}
