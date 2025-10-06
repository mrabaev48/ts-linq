import { MssqlGroupEmitter } from '../src/providers/mssql/emitters/MssqlGroupEmitter';
import type { QueryOptions, SqlParameter } from '@ts-linq/core';

test('group emitter renders GROUP BY and HAVING, collects params', () => {
  const emitter = new MssqlGroupEmitter();
  const params: SqlParameter[] = [];
  const sql = emitter.emit(params, {
    groupBy: {
      columns: ['region'],
      having: { condition: 'COUNT(*) > ?', parameters: [1] }
    }
  } as unknown as QueryOptions);
  expect(sql).toBe(' GROUP BY region HAVING COUNT(*) > ?');
  expect(params).toEqual([1]);
});
