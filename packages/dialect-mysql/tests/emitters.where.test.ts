import { MySqlWhereEmitter } from '../src';
import type { QueryOptions, SqlParameter } from '@ts-linq/core';

describe('MySqlWhereEmitter', () => {
  it('emits empty when no where', () => {
    const e = new MySqlWhereEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, { where: [] } as unknown as QueryOptions);
    expect(sql).toBe('');
    expect(params).toEqual([]);
  });

  it('emits WHERE and collects parameters', () => {
    const e = new MySqlWhereEmitter();
    const params: SqlParameter[] = [];
    const sql = e.emit(params, {
      where: [
        { condition: 'a = ?', parameters: [1] },
        { condition: 'b > ?', parameters: [2] }
      ]
    } as unknown as QueryOptions);
    expect(sql).toBe(' WHERE a = ? AND b > ?');
    expect(params).toEqual([1, 2]);
  });
});
