import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MysqlDialect } from '../src/query/MysqlDialect';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

@Entity({ name: 't' })
class T {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT' }) name!: string;
}

describe('MysqlDialect', () => {
  test('LIMIT and OFFSET', () => {
    new T();
    const d = new MysqlDialect();
    const { query } = d.buildSelect(T, { limit: 10, offset: 20 });
    expect(query).toMatch(/SELECT \* FROM `t` .*LIMIT 10 OFFSET 20/);
  });

  test('WHERE composition keeps placeholders', () => {
    new T();
    const d = new MysqlDialect();
    const { query, parameters } = d.buildSelect(T, {
      where: [{ condition: 'name = ? AND id > ?', parameters: ['a', 1] }] as any
    });
    expect(query).toContain('WHERE name = ? AND id > ?');
    expect(parameters).toEqual(['a', 1]);
  });
});
