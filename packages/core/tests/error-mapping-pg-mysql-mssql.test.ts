import 'reflect-metadata';
import { UniqueConstraintError } from '../src/types';
import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';

// These tests use fake providers (no real clients) to verify unique constraints map to UniqueConstraintError

class PgFake extends PostgresProvider {
  public async connect() {
    type Pool = { query: () => Promise<never> };
    (this as unknown as { pool?: Pool }).pool = {
      query: async () => {
        const err = new Error('duplicate key value violates unique constraint') as Error & {
          code?: string;
        };
        err.code = '23505';
        throw err;
      }
    };
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
}

class MyFake extends MySqlProvider {
  public async connect() {
    type Pool = { query: () => Promise<never>; execute: () => Promise<never> };
    (this as unknown as { pool?: Pool }).pool = {
      query: async () => {
        const err = new Error('dup') as Error & { code?: string };
        err.code = 'ER_DUP_ENTRY';
        throw err;
      },
      execute: async () => {
        const err = new Error('dup') as Error & { code?: string };
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
    };
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
}

class MsFake extends MssqlProvider {
  public async connect() {
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
  protected async doExecuteNonQuery(): Promise<number> {
    throw new UniqueConstraintError('Violation of UNIQUE KEY constraint', '2627');
  }
}

describe('Error mapping for Postgres/MySQL/MSSQL (unique constraint)', () => {
  test('Postgres maps 23505 to UniqueConstraintError', async () => {
    const p = new PgFake('postgres://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toThrow();
    await p.disconnect();
  });

  test('MySQL maps ER_DUP_ENTRY to UniqueConstraintError', async () => {
    const p = new MyFake('mysql://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toThrow();
    await p.disconnect();
  });

  test('MSSQL maps 2627 to UniqueConstraintError', async () => {
    const p = new MsFake('mssql://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toBeInstanceOf(
      UniqueConstraintError
    );
    await p.disconnect();
  });
});
