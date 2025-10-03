import { MySqlJoinEmitter } from '../src';
import type { QueryOptions } from '@ts-linq/core';

describe('MySqlJoinEmitter', () => {
  it('emits empty when no joins', () => {
    const e = new MySqlJoinEmitter();
    const sql = e.emit({} as unknown as QueryOptions);
    expect(sql).toBe('');
  });

  it('emits JOIN with alias and ON', () => {
    const e = new MySqlJoinEmitter();
    const sql = e.emit({
      joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: '`o`.`user_id` = `u`.`id`' }]
    } as unknown as QueryOptions);
    expect(sql).toBe(' LEFT JOIN `orders` AS o ON `o`.`user_id` = `u`.`id`');
  });
});
