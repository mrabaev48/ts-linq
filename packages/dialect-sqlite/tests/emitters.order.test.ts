import { SQLiteOrderEmitter } from '../src/providers/sqlite/emitters/SQLiteOrderEmitter';
import type { QueryOptions } from '@ts-linq/core';

test('order emitter joins clauses', () => {
  const emitter = new SQLiteOrderEmitter();
  const sql = emitter.emit({
    orderBy: [
      { column: 'a', direction: 'ASC' },
      { column: 'b', direction: 'DESC' }
    ]
  } as unknown as QueryOptions);
  expect(sql).toBe(' ORDER BY a ASC, b DESC');
});
