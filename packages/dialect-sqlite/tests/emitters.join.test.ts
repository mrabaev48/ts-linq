import { SQLiteJoinEmitter } from '../src/providers/sqlite/emitters/SQLiteJoinEmitter';
import type { QueryOptions } from '@ts-linq/core';

test('join emitter renders joins with alias and ON', () => {
  const emitter = new SQLiteJoinEmitter();
  const sql = emitter.emit({
    joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = u.id' }]
  } as unknown as QueryOptions);
  expect(sql).toBe(' LEFT JOIN orders AS o ON o.user_id = u.id');
});
