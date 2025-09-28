import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { PostgresDialect } from '../src/query/PostgresDialect';

@Entity({ name: 't' })
class T {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT' }) name!: string;
}

describe('PostgresDialect', () => {
  test('LIMIT and OFFSET (OFFSET allowed without LIMIT)', () => {
    new T();
    const d = new PostgresDialect();
    const a = d.buildSelect(T, { limit: 5 });
    expect(a.query).toMatch(/SELECT \* FROM "t" .*LIMIT 5(?!.*OFFSET)/);
    const b = d.buildSelect(T, { offset: 10 });
    expect(b.query).toMatch(/SELECT \* FROM "t" .*OFFSET 10/);
  });

  test('Numbered params $1..$n', () => {
    new T();
    const d = new PostgresDialect();
    const { query, parameters } = d.buildSelect(T, {
      where: [{ condition: 'name = ? AND id > ?', parameters: ['a', 1] }]
    });
    expect(query).toContain('name = $1 AND id > $2');
    expect(parameters).toEqual(['a', 1]);
  });
});
