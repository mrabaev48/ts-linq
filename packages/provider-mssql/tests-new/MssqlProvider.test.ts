import { describe, it, expect } from '@jest/globals';
import { MssqlProvider } from '../src/MssqlProvider';
import { MssqlDialect } from '@ts-linq/dialect-mssql';

describe('MssqlProvider', () => {
  describe('constructor', () => {
    it('should create provider with connection string', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('mssql');
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

      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;',
        mockLogger as unknown as typeof mockLogger
      );

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in constructor', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;',
        undefined,
        [mockMiddleware]
      );

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in constructor', () => {
      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;',
        undefined,
        undefined,
        { enabled: true, column: 'IsDeleted' }
      );

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in constructor', () => {
      const retryPolicy = {
        maxRetries: 3,
        shouldRetry: () => true
      };

      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;',
        undefined,
        undefined,
        undefined,
        retryPolicy
      );

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return MssqlDialect instance', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(MssqlDialect);
    });
  });

  describe('connection string handling', () => {
    it('should accept ADO.NET style connection string', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toBe(
        'Server=localhost;Database=testdb;'
      );
    });

    it('should accept connection string with authentication', () => {
      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;User Id=sa;Password=Password123;'
      );

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('User Id=sa');
    });

    it('should accept connection string with instance name', () => {
      const provider = new MssqlProvider('Server=localhost\\SQLEXPRESS;Database=testdb;');

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('SQLEXPRESS');
    });

    it('should accept connection string with integrated security', () => {
      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;Integrated Security=true;'
      );

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain(
        'Integrated Security=true'
      );
    });

    it('should accept connection string with encryption settings', () => {
      const provider = new MssqlProvider(
        'Server=localhost;Database=testdb;Encrypt=true;TrustServerCertificate=true;'
      );

      expect(provider).toBeDefined();
      expect((provider as unknown as { connectionString: string }).connectionString).toContain('Encrypt=true');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to mssql', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');

      expect((provider as unknown as { providerName: string }).providerName).toBe('mssql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new MssqlProvider('Server=localhost;Database=testdb;');

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });
});
