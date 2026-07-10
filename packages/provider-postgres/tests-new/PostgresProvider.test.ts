import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect } from '@ts-linq/types';
import { UnsupportedOperationError } from '@ts-linq/types';

import { PostgresProvider } from '../src/PostgresProvider';

describe('PostgresProvider', () => {
  describe('constructor', () => {
    it('should create provider with minimal config', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('postgresql');
    });

    it('should accept full config with all options', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'admin',
        password: 'secret',
        ssl: true,
        applicationName: 'MyApp'
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

      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        logger: mockLogger
      });

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in config', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        middlewares: [mockMiddleware]
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in config', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        softDelete: { enabled: true, column: 'deletedAt' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in config', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        retryPolicy: { shouldRetry: () => true, getDelayMs: () => 1000 }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return PostgresDialect instance', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(PostgresDialect);
    });
  });

  describe('connection string handling', () => {
    it('should build connection string from config', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'admin',
        password: 'secret'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('postgresql://');
      expect(connStr).toContain('admin');
      expect(connStr).toContain('localhost');
      expect(connStr).toContain('testdb');
    });

    it('should handle config without password', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('postgresql://postgres@localhost');
    });

    it('should include SSL mode when enabled', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        ssl: true
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('sslmode=require');
    });

    it('should include application name in query params', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        applicationName: 'MyApp'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('application_name=MyApp');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to postgresql', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });

      expect((provider as unknown as { providerName: string }).providerName).toBe('postgresql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });

  describe('connection string validation', () => {
    it('should handle IPv6 addresses', () => {
      const provider = new PostgresProvider({
        host: '::1',
        port: 5432,
        database: 'testdb',
        user: 'postgres'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('[::1]');
    });

    it('should include schema parameter', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        schema: 'public'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('schema=public');
    });

    it('should handle connection timeout', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        connectionTimeoutMs: 10000
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('connect_timeout=10');
    });
  });

  describe('parameter validation', () => {
    it('should handle undefined logger gracefully', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        logger: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle undefined middlewares gracefully', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        middlewares: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle empty middlewares array', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        middlewares: []
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete with custom column', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        softDelete: { enabled: true, column: 'deletedAt' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy', () => {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres',
        retryPolicy: { shouldRetry: () => true, getDelayMs: (attempt) => attempt * 1000 }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('CRUD capability guard (requireCrud)', () => {
    class NoCrudEntity {
      id!: number;
    }

    /** A dialect with no `buildInsert`/`buildUpdate`/`buildDelete` and no `capabilities` — the
     *  shape `requireCrud` must reject uniformly, in place of the old `TypeError` risk. */
    const noCrudDialect: SqlDialect = {
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] }),
      quoteIdentifier: (identifier: string) => `"${identifier}"`
    };

    beforeEach(() => {
      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(NoCrudEntity, 'no_crud');
      MetadataStorage.addColumn(NoCrudEntity, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      MetadataStorage.addPrimaryKey(NoCrudEntity, 'id');
    });

    afterEach(() => {
      MetadataStorage.getInstance().clear();
    });

    function providerWithNoCrudDialect(): PostgresProvider {
      const provider = new PostgresProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'postgres'
      });
      jest.spyOn(provider, 'getDialect').mockReturnValue(noCrudDialect);
      return provider;
    }

    it('insert() throws a typed UnsupportedOperationError when the dialect lacks buildInsert', async () => {
      const provider = providerWithNoCrudDialect();
      await expect(provider.insert(new NoCrudEntity(), NoCrudEntity)).rejects.toThrow(
        UnsupportedOperationError
      );
    });

    it('update() throws a typed UnsupportedOperationError when the dialect lacks buildUpdate', async () => {
      const provider = providerWithNoCrudDialect();
      await expect(provider.update(new NoCrudEntity(), NoCrudEntity)).rejects.toThrow(
        UnsupportedOperationError
      );
    });

    it('delete() throws a typed UnsupportedOperationError when the dialect lacks buildDelete', async () => {
      const provider = providerWithNoCrudDialect();
      await expect(provider.delete(new NoCrudEntity(), NoCrudEntity)).rejects.toThrow(
        UnsupportedOperationError
      );
    });
  });
});
