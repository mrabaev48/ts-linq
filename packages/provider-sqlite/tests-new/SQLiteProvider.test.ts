import { describe, it, expect } from '@jest/globals';
import { SQLiteProvider } from '../src/SQLiteProvider';
import { SQLiteDialect } from '@ts-linq/dialect-sqlite';

describe('SQLiteProvider', () => {
  describe('constructor', () => {
    it('should create provider with minimal config', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('sqlite');
    });

    it('should accept logger in config', () => {
      const mockLogger = {
        query: jest.fn(),
        transactionStart: jest.fn(),
        transactionEnd: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };

      const provider = new SQLiteProvider({
        file: ':memory:',
        logger: mockLogger as unknown as typeof mockLogger
      });

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in config', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new SQLiteProvider({
        file: ':memory:',
        middlewares: [mockMiddleware]
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in config', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        softDelete: { enabled: true, column: 'isDeleted' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in config', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        retryPolicy: { shouldRetry: () => true, getDelayMs: () => 1000 }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return SQLiteDialect instance', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(SQLiteDialect);
    });
  });

  describe('connection string handling', () => {
    it('should handle memory mode', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        ':memory:'
      );
    });

    it('should handle file path', () => {
      const provider = new SQLiteProvider({ file: './test.db' });

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe('./test.db');
    });

    it('should handle mode option for memory', () => {
      const provider = new SQLiteProvider({ file: 'test.db', mode: 'memory' });

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(':memory:');
    });

    it('should handle readonly mode', () => {
      const provider = new SQLiteProvider({ file: './data.db', mode: 'readonly' });

      expect(provider).toBeDefined();
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to sqlite', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });

      expect((provider as unknown as { providerName: string }).providerName).toBe('sqlite');
    });

    it('should initialize with isConnected false', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new SQLiteProvider({ file: ':memory:' });

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });

  describe('config validation', () => {
    it('should accept busyTimeoutMs option', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        busyTimeoutMs: 5000
      });

      expect(provider).toBeDefined();
    });

    it('should handle undefined logger gracefully', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        logger: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle undefined middlewares gracefully', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        middlewares: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle empty middlewares array', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        middlewares: []
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete with custom column', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        softDelete: { enabled: true, column: 'deletedAt' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy', () => {
      const provider = new SQLiteProvider({
        file: ':memory:',
        retryPolicy: { shouldRetry: () => false, getDelayMs: () => 1000 }
      });

      expect(provider).toBeDefined();
    });
  });
});
