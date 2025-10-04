import { MssqlWhereEmitter } from '../src/providers/mssql/emitters/MssqlWhereEmitter';
import type { QueryOptions, SqlParameter } from '@ts-linq/core';

test('where emitter concatenates AND and collects params', () => {
  const emitter = new MssqlWhereEmitter();
  const params: SqlParameter[] = [];
  const sql = emitter.emit(params, { where: [
    { condition: 'a = ?', parameters: [1] },
    { condition: 'b > ?', parameters: [2] }
  ] } as unknown as QueryOptions);
  expect(sql).toBe(' WHERE a = ? AND b > ?');
  expect(params).toEqual([1,2]);
});


