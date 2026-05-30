import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

import { MssqlDialect } from '../src/MssqlDialect';

const dialect = new MssqlDialect();

describe('MssqlDialect — buildUpdate with concurrency tokens', () => {
  test('isConcurrencyToken injects AND col = @pN with original value', () => {
    const titleCol: ColumnMetadata = {
      propertyName: 'title',
      columnName: 'title',
      type: 'TEXT',
      isConcurrencyToken: true
    } as ColumnMetadata;
    const meta: EntityMetadata = {
      tableName: 'articles',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
        titleCol
      ]
    } as EntityMetadata;
    const entity = { id: 1, title: 'New title' };
    const original = { title: 'Old title' };
    const tokens = [titleCol];
    const { sql, parameters } = dialect.buildUpdate(entity, meta, undefined, tokens, original);
    expect(sql).toContain('AND title = @p');
    expect(parameters[parameters.length - 1]).toBe('Old title');
  });
});

describe('MssqlDialect — buildDelete with concurrency tokens', () => {
  test('isConcurrencyToken appends AND col = @pN', () => {
    const titleCol: ColumnMetadata = {
      propertyName: 'title',
      columnName: 'title',
      type: 'TEXT',
      isConcurrencyToken: true
    } as ColumnMetadata;
    const meta: EntityMetadata = {
      tableName: 'articles',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
        titleCol
      ]
    } as EntityMetadata;
    const entity = { id: 1, title: 'Hello' };
    const original = { title: 'Original' };
    const { sql, parameters } = dialect.buildDelete(entity, meta, [titleCol], original);
    expect(sql).toContain('AND title = @p');
    expect(parameters[parameters.length - 1]).toBe('Original');
  });
});
