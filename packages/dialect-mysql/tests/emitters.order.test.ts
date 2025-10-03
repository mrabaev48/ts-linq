import { MySqlOrderEmitter } from '../src';
import type { QueryOptions } from '@ts-linq/core';

describe('MySqlOrderEmitter', () => {
  it('emits empty when no orderBy', () => {
    const e = new MySqlOrderEmitter();
    const sql = e.emit({} as unknown as QueryOptions);
    expect(sql).toBe('');
  });

  it('emits ORDER BY', () => {
    const e = new MySqlOrderEmitter();
    const sql = e.emit({ orderBy: [{ column: 'region', direction: 'ASC' }] } as any);
    expect(sql).toBe(' ORDER BY region ASC');
  });
});
