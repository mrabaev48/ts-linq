import { MySqlGroupEmitter } from '../src';
import type { QueryOptions, SqlParameter } from '@ts-linq/core';

describe('MySqlGroupEmitter', () => {
  it('emits empty when no groupBy', () => {
    const e = new MySqlGroupEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, {} as unknown as QueryOptions);
    expect(sql).toBe('');
    expect(params).toEqual([]);
  });

  it('emits GROUP BY and HAVING with params', () => {
    const e = new MySqlGroupEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, {
      groupBy: { columns: ['region'], having: { condition: 'COUNT(*) > ?', parameters: [10] } }
    } as unknown as QueryOptions);
    expect(sql).toBe(' GROUP BY region HAVING COUNT(*) > ?');
    expect(params).toEqual([10]);
  });
});
