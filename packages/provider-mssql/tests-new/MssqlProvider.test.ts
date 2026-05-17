import { describe, expect, it } from '@jest/globals';
import { MssqlDialect } from '@ts-linq/dialect-mssql';

import { MssqlProvider } from '../src/MssqlProvider';

describe('MssqlProvider', () => {
  describe('constructor', () => {
    it('should create provider with minimal config', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('mssql');
    });

    it('should accept full config with all options', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        port: 1433,
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        encrypt: true,
        trustServerCertificate: true
      });

      expect(provider).toBeDefined();
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

      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        logger: mockLogger
      });

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in config', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        middlewares: [mockMiddleware]
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in config', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        softDelete: { enabled: true, column: 'IsDeleted' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in config', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        retryPolicy: { shouldRetry: () => true, getDelayMs: () => 2000 }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return MssqlDialect instance', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(MssqlDialect);
    });
  });

  describe('connection string handling', () => {
    it('should build connection string from config', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Server=localhost');
      expect(connStr).toContain('Database=testdb');
      expect(connStr).toContain('User Id=sa');
      expect(connStr).toContain('Password=Password123');
    });

    it('should handle config with integrated security', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        integratedSecurity: true
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Integrated Security=true');
    });

    it('should include instance name', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        instanceName: 'SQLEXPRESS'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('SQLEXPRESS');
    });

    it('should include encryption settings', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        encrypt: true,
        trustServerCertificate: true
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Encrypt=true');
      expect(connStr).toContain('TrustServerCertificate=true');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to mssql', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });

      expect((provider as unknown as { providerName: string }).providerName).toBe('mssql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123'
      });

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });

  describe('connection string validation', () => {
    it('should accept connection string with timeout settings', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        connectionTimeout: 30
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Connection Timeout=30');
    });

    it('should accept connection string with pool configuration', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        poolOptions: { max: 100, min: 10 }
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Max Pool Size=100');
      expect(connStr).toContain('Min Pool Size=10');
    });

    it('should include application name', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        applicationName: 'MyApp'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('Application Name=MyApp');
    });
  });

  describe('parameter validation', () => {
    it('should handle undefined logger gracefully', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        logger: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle undefined middlewares gracefully', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        middlewares: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle empty middlewares array', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        middlewares: []
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete with custom column name', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        softDelete: { enabled: true, column: 'IsDeleted' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy with custom delay', () => {
      const provider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'Password123',
        retryPolicy: { shouldRetry: (err) => true, getDelayMs: () => 2000 }
      });

      expect(provider).toBeDefined();
    });
  });
});
