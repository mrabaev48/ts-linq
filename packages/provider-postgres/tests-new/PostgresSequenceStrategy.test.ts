import { describe, expect, it } from '@jest/globals';
import type { SequenceExecutionPort } from '@ts-linq/core';
import { DatabaseError } from '@ts-linq/types';

import { PostgresSequenceStrategy } from '../src/strategies/PostgresSequenceStrategy';

function port(rows: unknown[]): SequenceExecutionPort & { lastSql?: string } {
  const p = {
    lastSql: undefined as string | undefined,
    executeQuery: async <T>(sql: string): Promise<T[]> => {
      p.lastSql = sql;
      return rows as T[];
    },
    executeNonQuery: async (): Promise<number> => 0,
    providerLabel: 'postgresql'
  };
  return p;
}

describe('PostgresSequenceStrategy', () => {
  it('issues nextval with a schema-qualified, quoted name', async () => {
    const p = port([{ nextval: '40' }]);
    const value = await new PostgresSequenceStrategy().nextValue(p, 'order_seq', 'app', 10);
    expect(p.lastSql).toBe('SELECT nextval("app"."order_seq")');
    expect(value).toBe(40);
  });

  it('quotes a bare name when no schema is given', async () => {
    const p = port([{ nextval: '7' }]);
    await new PostgresSequenceStrategy().nextValue(p, 'order_seq', undefined, 1);
    expect(p.lastSql).toBe('SELECT nextval("order_seq")');
  });

  it('throws a typed DatabaseError when no row is returned', async () => {
    const p = port([]);
    await expect(
      new PostgresSequenceStrategy().nextValue(p, 'order_seq', undefined, 1)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
