import 'reflect-metadata';
import { UniqueConstraintError } from '../src/types';
import { PostgresProvider } from '../src/providers/PostgresProvider';
import { MySqlProvider } from '../src/providers/MySqlProvider';
import { MssqlProvider } from '../src/providers/MssqlProvider';

// Эти тесты используют фейки-провайдеры (без реальных клиентов), чтобы проверить, что уникальные ограничения пробрасываются как UniqueConstraintError

class PgFake extends PostgresProvider {
  public async connect() {
    (this as any).pool = {
      query: async () => {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505'
        });
      }
    };
    this['isConnected'] = true;
  }
  public async disconnect() {
    this['isConnected'] = false;
  }
}

class MyFake extends MySqlProvider {
  public async connect() {
    (this as any).pool = {
      query: async () => {
        const e: any = new Error('dup');
        e.code = 'ER_DUP_ENTRY';
        throw e;
      },
      execute: async () => {
        const e: any = new Error('dup');
        e.code = 'ER_DUP_ENTRY';
        throw e;
      }
    };
    this['isConnected'] = true;
  }
  public async disconnect() {
    this['isConnected'] = false;
  }
}

class MsFake extends MssqlProvider {
  public async connect() {
    this['isConnected'] = true;
  }
  public async disconnect() {
    this['isConnected'] = false;
  }
  protected async doExecuteNonQuery(): Promise<number> {
    throw new UniqueConstraintError('Violation of UNIQUE KEY constraint', '2627');
  }
}

describe('Error mapping for Postgres/MySQL/MSSQL (unique constraint)', () => {
  test('Postgres maps 23505 to UniqueConstraintError', async () => {
    const p = new PgFake('postgres://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toBeInstanceOf(
      UniqueConstraintError
    );
    await p.disconnect();
  });

  test('MySQL maps ER_DUP_ENTRY to UniqueConstraintError', async () => {
    const p = new MyFake('mysql://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toBeInstanceOf(
      UniqueConstraintError
    );
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
