import { describe, expect, it } from '@jest/globals';
import type { SequenceExecutionPort } from '@ts-linq/core';
import { DatabaseError } from '@ts-linq/types';

import { MySqlSequenceStrategy } from '../src/strategies/MySqlSequenceStrategy';

interface Recorder {
  port: SequenceExecutionPort;
  nonQueries: string[];
  queries: string[];
}

function recorder(rows: unknown[]): Recorder {
  const nonQueries: string[] = [];
  const queries: string[] = [];
  const port: SequenceExecutionPort = {
    executeNonQuery: async (sql: string): Promise<number> => {
      nonQueries.push(sql);
      return 1;
    },
    executeQuery: async <T>(sql: string): Promise<T[]> => {
      queries.push(sql);
      return rows as T[];
    },
    providerLabel: 'mysql'
  };
  return { port, nonQueries, queries };
}

describe('MySqlSequenceStrategy', () => {
  it('advances the counter (UPDATE) then reads it back (SELECT)', async () => {
    const r = recorder([{ val: 50 }]);
    const value = await new MySqlSequenceStrategy().nextValue(r.port, 'order_seq', undefined, 10);
    expect(value).toBe(50);
    expect(r.nonQueries).toHaveLength(1);
    expect(r.queries).toHaveLength(1);
  });

  it('throws a typed DatabaseError when the counter row is missing', async () => {
    const r = recorder([]);
    await expect(
      new MySqlSequenceStrategy().nextValue(r.port, 'order_seq', undefined, 10)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
