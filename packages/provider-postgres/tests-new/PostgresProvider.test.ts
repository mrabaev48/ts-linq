import { describe, it, expect } from '@jest/globals';
import { PostgresProvider } from '../src/PostgresProvider';
import { PostgresDialect } from '@ts-linq/dialect-postgres';

describe('PostgresProvider', () => {
  describe('constructor', () => {
    it('should create provider with connection string', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('postgresql');
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

      const provider = new PostgresProvider('postgresql://localhost/testdb', mockLogger as unknown as typeof mockLogger);

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in constructor', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new PostgresProvider('postgresql://localhost/testdb', undefined, [mockMiddleware]);

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in constructor', () => {
      const provider = new PostgresProvider(
        'postgresql://localhost/testdb',
        undefined,
        undefined,
        { enabled: true, column: 'deletedAt' }
      );

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in constructor', () => {
      const retryPolicy = {
        maxRetries: 3,
        shouldRetry: () => true
      };

      const provider = new PostgresProvider(
        'postgresql://localhost/testdb',
        undefined,
        undefined,
        undefined,
        retryPolicy
      );

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return PostgresDialect instance', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb');
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(PostgresDialect);
    });
  });

  describe('connection string handling', () => {
    it('should accept standard PostgreSQL connection string', () => {
      const provider = new PostgresProvider('postgresql://user:password@localhost:5432/dbname');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        'postgresql://user:password@localhost:5432/dbname'
      );
    });

    it('should accept postgres:// protocol', () => {
      const provider = new PostgresProvider('postgres://localhost/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        'postgres://localhost/testdb'
      );
    });

    it('should accept connection string with SSL parameters', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb?sslmode=require');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('sslmode=require');
    });

    it('should accept connection string with schema', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb?schema=public');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('schema=public');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to postgres', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb');

      expect((provider as unknown as { providerName: string }).providerName).toBe('postgresql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb');

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new PostgresProvider('postgresql://localhost/testdb');

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });
});
