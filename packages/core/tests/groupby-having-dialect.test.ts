import { MetadataStorage } from '@ts-linq/core';
import { SQLiteDialect } from '@ts-linq/provider-sqlite';
import { PostgresDialect } from '@ts-linq/provider-postgres';
import { MssqlDialect } from '@ts-linq/provider-mssql';
import { MysqlDialect } from '@ts-linq/provider-mysql';

class T {
  id!: number;
  authorId!: number;
  name!: string;
}

import type { QueryOptions } from '../src/types';
const options: QueryOptions = {
  select: ['authorId'],
  groupBy: { columns: ['authorId'], having: { condition: 'COUNT(*) > ?', parameters: [1] } }
};

describe('GROUP BY / HAVING in dialects', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'authorId',
      columnName: 'authorId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
  });
  test('SQLite', () => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'authorId',
      columnName: 'authorId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
    const d = new SQLiteDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > ?');
    expect(parameters).toEqual([1]);
  });
  test('Postgres', () => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'authorId',
      columnName: 'authorId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
    const d = new PostgresDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > $1');
    expect(parameters).toEqual([1]);
  });
  test('MSSQL', () => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'authorId',
      columnName: 'authorId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
    const d = new MssqlDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    // MSSQL converts placeholders to @p1.. numbering after parameter binding; with 1 param it becomes @p1
    expect(query).toContain('HAVING COUNT(*) > @p1');
    expect(parameters).toEqual([1]);
  });
  test('MySQL', () => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(T, 't');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'authorId',
      columnName: 'authorId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(T, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(T, 'id');
    const d = new MysqlDialect();
    const { query, parameters } = d.buildSelect(T, options);
    expect(query).toContain('GROUP BY authorId');
    expect(query).toContain('HAVING COUNT(*) > ?');
    expect(parameters).toEqual([1]);
  });
});
