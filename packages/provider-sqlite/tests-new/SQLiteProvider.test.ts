import { describe, it, expect } from '@jest/globals';
import { SQLiteProvider } from '../src/SQLiteProvider';
import { SQLiteDialect } from '@ts-linq/dialect-sqlite';

describe('SQLiteProvider', () => {
  describe('constructor', () => {
    it('should create provider with connection string', () => {
      const provider = new SQLiteProvider(':memory:');

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('sqlite');
    });

    it('should accept logger in constructor', () => {
      const mockLogger = {
        query: jest.fn(),
        transactionStart: jest.fn(),
        transactionEnd: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };

      const provider = new SQLiteProvider(':memory:', mockLogger as unknown as typeof mockLogger);

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in constructor', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new SQLiteProvider(':memory:', undefined, [mockMiddleware]);

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in constructor', () => {
      const provider = new SQLiteProvider(
        ':memory:',
        undefined,
        undefined,
        { enabled: true, column: 'isDeleted' }
      );

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in constructor', () => {
      const retryPolicy = {
        maxRetries: 3,
        shouldRetry: () => true
      };

      const provider = new SQLiteProvider(
        ':memory:',
        undefined,
        undefined,
        undefined,
        retryPolicy
      );

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return SQLiteDialect instance', () => {
      const provider = new SQLiteProvider(':memory:');
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(SQLiteDialect);
    });
  });

  describe('connection string handling', () => {
    it('should accept file-based connection string', () => {
      const provider = new SQLiteProvider('./test.db');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe('./test.db');
    });

    it('should accept in-memory connection string', () => {
      const provider = new SQLiteProvider(':memory:');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(':memory:');
    });

    it('should accept absolute path connection string', () => {
      const provider = new SQLiteProvider('/tmp/test.db');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe('/tmp/test.db');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to sqlite', () => {
      const provider = new SQLiteProvider(':memory:');

      expect((provider as unknown as { providerName: string }).providerName).toBe('sqlite');
    });

    it('should initialize with isConnected false', () => {
      const provider = new SQLiteProvider(':memory:');

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new SQLiteProvider(':memory:');

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });
});
