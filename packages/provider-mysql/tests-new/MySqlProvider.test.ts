import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect } from '@ts-linq/types';
import { UnsupportedOperationError } from '@ts-linq/types';

import { MySqlProvider } from '../src/MySqlProvider';

describe('MySqlProvider', () => {
  describe('constructor', () => {
    it('should create provider with minimal config', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });

      expect(provider).toBeDefined();
      expect((provider as unknown as { providerName: string }).providerName).toBe('mysql');
    });

    it('should accept full config with all options', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'root',
        password: 'secret',
        charset: 'utf8mb4'
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

      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        logger: mockLogger
      });

      expect(provider).toBeDefined();
    });

    it('should accept middlewares in config', () => {
      const mockMiddleware = {
        beforeExecute: jest.fn(),
        afterExecute: jest.fn()
      };

      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        middlewares: [mockMiddleware]
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete options in config', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        softDelete: { enabled: true, column: 'isDeleted' }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy in config', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        retryPolicy: { shouldRetry: () => true, getDelayMs: () => 500 }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('getDialect', () => {
    it('should return MysqlDialect instance', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });
      const dialect = provider.getDialect();

      expect(dialect).toBeInstanceOf(MysqlDialect);
    });
  });

  describe('connection string handling', () => {
    it('should build connection string from config', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'root',
        password: 'secret'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('mysql://');
      expect(connStr).toContain('root');
      expect(connStr).toContain('localhost');
      expect(connStr).toContain('testdb');
    });

    it('should handle config without password', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('mysql://root@localhost');
    });

    it('should include charset in query params', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        charset: 'utf8mb4'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('charset=utf8mb4');
    });

    it('should include custom port', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        port: 3307,
        database: 'testdb',
        user: 'root'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain(':3307');
    });
  });

  describe('provider metadata', () => {
    it('should have providerName set to mysql', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });

      expect((provider as unknown as { providerName: string }).providerName).toBe('mysql');
    });

    it('should initialize with isConnected false', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });

      expect((provider as unknown as { isConnected: boolean }).isConnected).toBe(false);
    });

    it('should initialize with inTransaction false', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
      });

      expect((provider as unknown as { inTransaction: boolean }).inTransaction).toBe(false);
    });
  });

  describe('connection string validation', () => {
    it('should accept connection string with multiple query parameters', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        charset: 'utf8mb4',
        timezone: 'UTC'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('charset=utf8mb4');
      expect(connStr).toContain('timezone=UTC');
    });

    it('should handle socket path connections', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        socketPath: '/var/run/mysqld/mysqld.sock'
      });

      expect(provider).toBeDefined();
      const connStr = (provider as unknown as { connectionString: string }).connectionString;
      expect(connStr).toContain('socketPath');
    });
  });

  describe('parameter validation', () => {
    it('should handle undefined logger gracefully', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        logger: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle undefined middlewares gracefully', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        middlewares: undefined
      });

      expect(provider).toBeDefined();
    });

    it('should handle empty middlewares array', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        middlewares: []
      });

      expect(provider).toBeDefined();
    });

    it('should accept softDelete with enabled false', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        softDelete: { enabled: false }
      });

      expect(provider).toBeDefined();
    });

    it('should accept retryPolicy', () => {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root',
        retryPolicy: {
          shouldRetry: (err, attempt) => attempt < 3,
          getDelayMs: (attempt) => attempt * 500
        }
      });

      expect(provider).toBeDefined();
    });
  });

  describe('CRUD capability guard (requireCrud)', () => {
    class NoCrudEntity {
      id!: number;
    }

    /** A dialect with no `buildInsert`/`buildUpdate`/`buildDelete` and no `capabilities` — the
     *  shape `requireCrud` must reject uniformly, in place of the old ad-hoc `new Error(...)`. */
    const noCrudDialect: SqlDialect = {
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] }),
      quoteIdentifier: (identifier: string) => `\`${identifier}\``
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

    function providerWithNoCrudDialect(): MySqlProvider {
      const provider = new MySqlProvider({
        host: 'localhost',
        database: 'testdb',
        user: 'root'
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
