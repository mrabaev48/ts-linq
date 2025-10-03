import { PgWhereEmitter } from '../src';
import type { QueryOptions, SqlParameter } from '@ts-linq/core';

describe('PgWhereEmitter', () => {
  it('emits empty when no where', () => {
    const e = new PgWhereEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, { where: [] } as unknown as QueryOptions);
    expect(sql).toBe('');
    expect(params).toEqual([]);
  });

  it('emits WHERE and collects parameters', () => {
    const e = new PgWhereEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, {
      where: [
        { condition: 'a = $1', parameters: [1] },
        { condition: 'b > $2', parameters: [2] }
      ]
    } as unknown as QueryOptions);
    expect(sql).toBe(' WHERE a = $1 AND b > $2');
    expect(params).toEqual([1, 2]);
  });
});
