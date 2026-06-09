import { describe, expect, it } from '@jest/globals';
import type { SqlParameter } from '@ts-linq/types';

import { PostgresProvider } from '../src/PostgresProvider';

/**
 * Capture the SQL handed to the driver so the dialect-correct identifier quoting
 * of the inherited `queryJunction` capability can be asserted without a real DB.
 */
class CapturingPostgresProvider extends PostgresProvider {
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

describe('PostgresProvider.queryJunction (dialect quoting)', () => {
  it('quotes junction identifiers with double quotes and parameterizes values', async () => {
    const provider = new CapturingPostgresProvider({
      host: 'localhost',
      database: 'testdb',
      user: 'postgres'
    });

    await provider.queryJunction({
      table: 'post_tags',
      selectColumns: ['post_id', 'tag_id'],
      whereColumn: 'post_id',
      whereValues: [1, 2]
    });

    expect(provider.lastSql).toBe(
      'SELECT "post_id", "tag_id" FROM "post_tags" WHERE "post_id" IN (?, ?)'
    );
    expect(provider.lastParams).toEqual([1, 2]);
  });
});
