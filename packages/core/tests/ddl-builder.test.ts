import { DdlBuilder } from '../src/DdlBuilder';

describe('DdlBuilder', () => {
  test('buildCreateTableSql delegates to strategy', () => {
    const strategy = {
      generateCreateTableSql: jest.fn(() => 'CREATE TABLE X'),
      generateCreateIndexSql: jest.fn()
    } as any;
    const builder = new DdlBuilder(strategy);
    const sql = builder.buildCreateTableSql({} as any);
    expect(sql).toBe('CREATE TABLE X');
    expect(strategy.generateCreateTableSql).toHaveBeenCalled();
  });

  test('buildCreateIndexesSql maps metadata.indexes', () => {
    const strategy = {
      generateCreateTableSql: jest.fn(),
      generateCreateIndexSql: jest.fn(() => 'CREATE INDEX i1 ON T(a)')
    } as any;
    const builder = new DdlBuilder(strategy);
    const res = builder.buildCreateIndexesSql({
      tableName: 'T',
      indexes: [{ name: 'i1', columns: ['a'], unique: false }]
    } as any);
    expect(res).toEqual(['CREATE INDEX i1 ON T(a)']);
    expect(strategy.generateCreateIndexSql).toHaveBeenCalledWith('T', {
      name: 'i1',
      columns: ['a'],
      unique: false
    });
  });

  test('buildAll returns table and indexes together', () => {
    const strategy = {
      generateCreateTableSql: jest.fn(() => 'CREATE TABLE T (id INT)'),
      generateCreateIndexSql: jest.fn(() => 'CREATE INDEX i1 ON T(id)')
    } as any;
    const builder = new DdlBuilder(strategy);
    const res = builder.buildAll({
      tableName: 'T',
      indexes: [{ name: 'i1', columns: ['id'] }]
    } as any);
    expect(res.tableSql).toContain('CREATE TABLE');
    expect(res.indexSqls).toHaveLength(1);
  });
});
