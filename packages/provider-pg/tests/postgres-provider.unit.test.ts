import { PostgresProvider } from '../src';
import type { SqlParameter } from '@ts-linq/core';

class PoolDouble {
  public queries: Array<{ sql: string; params?: readonly SqlParameter[] }> = [];
  async query<T = unknown>(
    sql: string,
    params?: readonly SqlParameter[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    this.queries.push({ sql, params });
    if (/RETURNING \*/.test(sql)) {
      return { rows: [{} as T], rowCount: 1 };
    }
    return { rows: [] as T[], rowCount: 1 };
  }
  async end(): Promise<void> {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setPool(p: PostgresProvider, pool: any) {
  // @ts-expect-error override private for test
  p.pool = pool;
}

describe('PostgresProvider (unit, mocked pool)', () => {
  it('doExecuteNonQuery forwards to pool', async () => {
    const p = new PostgresProvider('postgres://test');
    setPool(p, new PoolDouble());
    const n = await p.executeNonQuery('UPDATE t SET a=$1', [1]);
    expect(n).toBe(1);
  });

  it('doExecuteQuery returns rows from pool', async () => {
    const prov = new PostgresProvider('postgres://test');
    const pool = new PoolDouble();
    setPool(prov, pool);
    const rows = await prov.executeQuery('SELECT 1');
    expect(Array.isArray(rows)).toBe(true);
  });
});
