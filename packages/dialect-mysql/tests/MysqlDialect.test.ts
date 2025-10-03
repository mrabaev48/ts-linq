import { MysqlDialect } from '../src';
import { MetadataStorage } from '@ts-linq/core';

class T {
  id!: number;
}

beforeAll(() => {
  MetadataStorage.addEntity(T, 't');
  MetadataStorage.addColumn(T, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true
  });
});

describe('MysqlDialect', () => {
  it('builds simple select', () => {
    const d = new MysqlDialect();
    const { query, parameters } = d.buildSelect(T, { where: [], orderBy: [], joins: [] });
    expect(query).toContain('SELECT * FROM `t`');
    expect(parameters).toEqual([]);
  });
});
