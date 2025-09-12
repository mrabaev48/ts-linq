import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { SQLiteDialect } from '../src/query/SQLiteDialect';
import { PostgresDialect } from '../src/query/PostgresDialect';
import { MssqlDialect } from '../src/query/MssqlDialect';
import { MysqlDialect } from '../src/query/MysqlDialect';

@Entity({ name: 't' })
class T {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'INTEGER' }) authorId!: number;
  @Column({ type: 'TEXT' }) name!: string;
}

import type { QueryOptions } from '../src/types';
const options: QueryOptions = {
  select: ['authorId'],
  groupBy: { columns: ['authorId'], having: { condition: 'COUNT(*) > ?', parameters: [1] } }
};

describe('GROUP BY / HAVING in dialects', () => {
  test('SQLite', () => {
    new T();
    const d = new SQLiteDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > ?');
    expect(parameters).toEqual([1]);
  });
  test('Postgres', () => {
    new T();
    const d = new PostgresDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > $1');
    expect(parameters).toEqual([1]);
  });
  test('MSSQL', () => {
    new T();
    const d = new MssqlDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    // MSSQL converts placeholders to @p1.. numbering after parameter binding; with 1 param it becomes @p1
    expect(query).toContain('HAVING COUNT(*) > @p1');
    expect(parameters).toEqual([1]);
  });
  test('MySQL', () => {
    new T();
    const d = new MysqlDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > ?');
    expect(parameters).toEqual([1]);
  });
});
