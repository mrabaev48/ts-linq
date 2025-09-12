import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MssqlDialect } from '../src/query/MssqlDialect';

@Entity({ name: 't' })
class T {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT' }) name!: string;
}

describe('MssqlDialect', () => {
  test('TOP with limit only', () => {
    new T();
    const d = new MssqlDialect();
    const { query } = d.buildSelect(T, { limit: 5 });
    expect(query).toMatch(/^SELECT TOP \(5\) \* FROM \[t\]/);
  });
  test('OFFSET/FETCH with order fallback', () => {
    new T();
    const d = new MssqlDialect();
    const { query } = d.buildSelect(T, { offset: 10 });
    expect(query).toContain('FROM [t]');
    expect(query).toContain('ORDER BY (SELECT NULL) OFFSET 10 ROWS');
  });
  test('Numbered params @p1..', () => {
    new T();
    const d = new MssqlDialect();
    const { query } = d.buildSelect(T, {
      where: [{ condition: 'name = ? AND id > ?', parameters: ['a', 1] }] as any
    });
    expect(query).toContain('name = @p1 AND id > @p2');
  });
});
