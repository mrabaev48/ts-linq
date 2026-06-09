import { describe, expect, it } from '@jest/globals';
import type { SqlParameter } from '@ts-linq/types';

import { MssqlProvider } from '../src/MssqlProvider';

/**
 * Capture the SQL handed to the driver so the dialect-correct identifier quoting
 * of the inherited `queryJunction` capability can be asserted without a real DB.
 */
class CapturingMssqlProvider extends MssqlProvider {
  public lastSql?: string;
  public lastParams?: readonly SqlParameter[];

  protected override async doExecuteQuery<T>(
    sql: string,
    params?: readonly SqlParameter[]
  ): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params;
    return [] as T[];
  }
}

describe('MssqlProvider.queryJunction (dialect quoting)', () => {
  it('quotes junction identifiers with square brackets and parameterizes values', async () => {
    const provider = new CapturingMssqlProvider({
      server: 'localhost',
      database: 'testdb',
      user: 'sa',
      password: 'Password123'
    });

    await provider.queryJunction({
      table: 'post_tags',
      selectColumns: ['post_id', 'tag_id'],
      whereColumn: 'post_id',
      whereValues: [1, 2]
    });

    expect(provider.lastSql).toBe(
      'SELECT [post_id], [tag_id] FROM [post_tags] WHERE [post_id] IN (?, ?)'
    );
    expect(provider.lastParams).toEqual([1, 2]);
  });
});
