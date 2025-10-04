import { createMySqlPool } from '../src/mysql/PoolAdapter';

jest.mock('mysql2/promise', () => ({
  createPool: (cs: string) => ({
    __cs: cs,
    query: jest.fn(async () => [{}]),
    execute: jest.fn(async () => [{}]),
    end: jest.fn(async () => {})
  })
}));

describe('PoolAdapter', () => {
  it('creates pool via mysql2/promise', async () => {
    const pool = createMySqlPool('mysql://test');
    expect((pool as any).__cs).toBe('mysql://test');
    await pool.query('SELECT 1');
    await pool.execute('SELECT 1');
    await pool.end();
  });
});
