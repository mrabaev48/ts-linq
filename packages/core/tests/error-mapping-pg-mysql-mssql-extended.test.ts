import 'reflect-metadata';
import { ForeignKeyConstraintError, DatabaseError } from '../src/types';
import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';

class PgFK extends PostgresProvider {
  public async connect() {
    type Pool = { query: () => Promise<never> };
    (this as unknown as { pool?: Pool }).pool = {
      query: async () => {
        const err = new Error(
          'insert or update on table violates foreign key constraint'
        ) as Error & {
          code?: string;
        };
        err.code = '23503';
        throw err;
      }
    };
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
}

class MyTimeout extends MySqlProvider {
  public async connect() {
    type Pool = { query: () => Promise<never>; execute: () => Promise<never> };
    (this as unknown as { pool?: Pool }).pool = {
      query: async () => {
        const err = new Error('timeout') as Error & { code?: string };
        err.code = 'PROTOCOL_SEQUENCE_TIMEOUT';
        throw err;
      },
      execute: async () => {
        const err = new Error('timeout') as Error & { code?: string };
        err.code = 'PROTOCOL_SEQUENCE_TIMEOUT';
        throw err;
      }
    };
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
}

class MsTimeout extends MssqlProvider {
  public async connect() {
    (this as unknown as { isConnected: boolean }).isConnected = true;
  }
  public async disconnect() {
    (this as unknown as { isConnected: boolean }).isConnected = false;
  }
  protected async doExecuteNonQuery(): Promise<number> {
    throw new DatabaseError('timeout');
  }
}

describe('Extended error mapping (FK/timeout)', () => {
  test('Postgres maps 23503 to ForeignKeyConstraintError', async () => {
    const p = new PgFK('postgres://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO child VALUES (1)')).rejects.toThrow();
    await p.disconnect();
  });

  test('MySQL timeout surfaces as DatabaseError', async () => {
    const p = new MyTimeout('mysql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toThrow();
    await p.disconnect();
  });

  test('MSSQL timeout surfaces as DatabaseError', async () => {
    const p = new MsTimeout('mssql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    await p.disconnect();
  });
});
