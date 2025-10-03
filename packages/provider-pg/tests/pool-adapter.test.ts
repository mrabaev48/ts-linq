jest.mock('pg', () => {
  class PoolMock {
    public ended = false;
    public queries: Array<{ sql: string; params?: unknown[] }> = [];
    constructor(_: { connectionString: string }) {}
    async query<T = unknown>(
      sql: string,
      params?: unknown[]
    ): Promise<{ rows: T[]; rowCount: number }> {
      this.queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }
    async end(): Promise<void> {
      this.ended = true;
    }
  }
  return { Pool: PoolMock };
});

import { createPgPool } from '../src/pg/PoolAdapter';

describe('PoolAdapter', () => {
  it('creates pool and proxies query/end', async () => {
    const pool = createPgPool('postgres://test');
    const res = await pool.query('SELECT 1');
    expect(res.rowCount).toBe(0);
    await expect(pool.end()).resolves.toBeUndefined();
  });
});
