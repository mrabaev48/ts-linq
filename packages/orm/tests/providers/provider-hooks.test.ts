import 'reflect-metadata';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { DatabaseProvider } from '@ts-linq/core';
import type { SqlParameter } from '@ts-linq/core';

class HookedProvider extends SQLiteProvider {
  public before: Array<string> = [];
  public after: Array<string> = [];
  protected async beforeExecute(sql: string, params: readonly SqlParameter[]): Promise<void> {
    this.before.push(sql);
  }
  protected async afterExecute(
    sql: string,
    params: readonly SqlParameter[],
    result: unknown
  ): Promise<void> {
    this.after.push(sql);
  }
}

describe('DatabaseProvider Template Method hooks', () => {
  it('invokes before/after hooks', async () => {
    const provider = new HookedProvider(':memory:');
    await provider.connect();
    await provider.executeNonQuery('CREATE TABLE t (id INTEGER)');
    await provider.executeQuery('SELECT 1');
    expect(provider.before.length).toBeGreaterThan(0);
    expect(provider.after.length).toBeGreaterThan(0);
    await provider.disconnect();
  });
});
