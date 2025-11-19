import { describe, it, expect } from '@jest/globals';
import { MySqlProvider } from '../src/MySqlProvider';
import { MysqlDialect } from '@ts-linq/dialect-mysql';

describe('MySqlProvider', () => {
  describe('constructor', () => {
    it('should create provider with connection string', () => {
      const provider = new MySqlProvider('mysql://root@localhost/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('mysql');
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

      const provider = new MySqlProvider(
        'mysql://root@localhost/testdb',
        mockLogger as unknown as typeof mockLogger
      );

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in constructor', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new MySqlProvider(
        'mysql://root@localhost/testdb',
        undefined,
        [mockMiddleware]
      );

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in constructor', () => {
      const provider = new MySqlProvider(
        'mysql://root@localhost/testdb',
        undefined,
        undefined,
        { enabled: true, column: 'deleted_at' }
      );

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in constructor', () => {
      const retryPolicy = {
        maxRetries: 3,
        shouldRetry: () => true
      };

      const provider = new MySqlProvider(
        'mysql://root@localhost/testdb',
        undefined,
        undefined,
        undefined,
        retryPolicy
      );

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return MysqlDialect instance', () => {
      const provider = new MySqlProvider('mysql://root@localhost/testdb');
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(MysqlDialect);
    });
  });

  describe('connection string handling', () => {
    it('should accept mysql:// protocol', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        'mysql://localhost/testdb'
      );
    });

    it('should accept connection string with user and password', () => {
      const provider = new MySqlProvider('mysql://root:password@localhost/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        'mysql://root:password@localhost/testdb'
      );
    });

    it('should accept connection string with port', () => {
      const provider = new MySqlProvider('mysql://root@localhost:3307/testdb');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain(':3307');
    });

    it('should accept connection string with charset parameter', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb?charset=utf8mb4');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('charset=utf8mb4');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to mysql', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb');

      expect((provider as unknown as { providerName: string }).providerName).toBe('mysql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb');

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb');

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });

  describe('connection string validation', () => {
    it('should accept connection string with multiple query parameters', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb?charset=utf8mb4&timezone=UTC');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('charset=utf8mb4');
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('timezone=UTC');
    });

    it('should preserve connection string with SSL options', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb?ssl=true');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('ssl=true');
    });
  });

  describe('parameter validation', () => {
    it('should handle undefined logger gracefully', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb', undefined);

      expect(provider).toBeDefined();
    });

    it('should handle undefined middlewares gracefully', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb', undefined, undefined);

      expect(provider).toBeDefined();
    });

    it('should handle empty middlewares array', () => {
      const provider = new MySqlProvider('mysql://localhost/testdb', undefined, []);

      expect(provider).toBeDefined();
    });

    it('should accept softDelete with enabled false', () => {
      const provider = new MySqlProvider(
        'mysql://localhost/testdb',
        undefined,
        undefined,
        { enabled: false }
      );

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy', () => {
      const provider = new MySqlProvider(
        'mysql://localhost/testdb',
        undefined,
        undefined,
        undefined,
        { shouldRetry: (err, attempt) => attempt < 3, getDelayMs: (attempt) => attempt * 500 }
      );

      expect(provider).toBeDefined();
    });
  });
});
