import { describe, expect, it } from '@jest/globals';
import type { SequenceExecutionPort } from '@ts-linq/core';
import { DatabaseError } from '@ts-linq/types';

import { MssqlSavepointStrategy } from '../src/strategies/MssqlSavepointStrategy';
import { MssqlSequenceStrategy } from '../src/strategies/MssqlSequenceStrategy';

function port(rows: unknown[]): SequenceExecutionPort & { lastSql?: string } {
  const p = {
    lastSql: undefined as string | undefined,
    executeQuery: async <T>(sql: string): Promise<T[]> => {
      p.lastSql = sql;
      return rows as T[];
    },
    executeNonQuery: async (): Promise<number> => 0,
    providerLabel: 'mssql'
  };
  return p;
}

describe('MssqlSavepointStrategy', () => {
  it('uses T-SQL SAVE/ROLLBACK TRANSACTION and a no-op release', () => {
    const s = new MssqlSavepointStrategy();
    expect(s.createSql('sp1')).toBe('SAVE TRANSACTION sp1');
    expect(s.rollbackToSql('sp1')).toBe('ROLLBACK TRANSACTION sp1');
    expect(s.releaseSql()).toBeNull();
  });
});

describe('MssqlSequenceStrategy', () => {
  it('issues NEXT VALUE FOR with a bracket-qualified name', async () => {
    const p = port([{ val: 200 }]);
    const value = await new MssqlSequenceStrategy().nextValue(p, 'order_seq', 'dbo', 10);
    expect(p.lastSql).toBe('SELECT NEXT VALUE FOR [dbo].[order_seq] AS val');
    expect(value).toBe(200);
  });

  it('throws a typed DatabaseError when no row is returned', async () => {
    const p = port([]);
    await expect(
      new MssqlSequenceStrategy().nextValue(p, 'order_seq', undefined, 1)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
