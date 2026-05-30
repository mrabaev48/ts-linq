import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

import { PostgresDialect } from '../src/PostgresDialect';

const dialect = new PostgresDialect();

function makeMetadata(overrides?: Partial<EntityMetadata>): EntityMetadata {
  return {
    tableName: 'articles',
    primaryKeys: ['id'],
    columns: [
      { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true },
      { propertyName: 'title', columnName: 'title', type: 'TEXT' },
      {
        propertyName: 'version',
        columnName: 'version',
        type: 'INT',
        isVersion: true,
        isConcurrencyToken: true
      }
    ],
    ...overrides
  } as EntityMetadata;
}

describe('PostgresDialect — buildUpdate with concurrency tokens', () => {
  test('no concurrency tokens — standard UPDATE', () => {
    const meta = makeMetadata();
    meta.columns = [
      { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
      { propertyName: 'title', columnName: 'title', type: 'TEXT' } as ColumnMetadata
    ];
    const entity = { id: 1, title: 'Hello' };
    const { sql } = dialect.buildUpdate(entity, meta);
    expect(sql).toContain('WHERE');
    expect(sql).not.toContain('AND');
  });

  test('isConcurrencyToken (non-version) injects AND col = $N with original value', () => {
    const meta: EntityMetadata = {
      tableName: 'articles',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
        {
          propertyName: 'title',
          columnName: 'title',
          type: 'TEXT',
          isConcurrencyToken: true
        } as ColumnMetadata
      ]
    } as EntityMetadata;
    const entity = { id: 1, title: 'New title' };
    const original = { id: 1, title: 'Old title' };
    const tokens = meta.columns.filter((c) => c.isConcurrencyToken && !c.isVersion);
    const { sql, parameters } = dialect.buildUpdate(entity, meta, undefined, tokens, original);
    expect(sql).toContain('AND "title" =');
    const lastParam = parameters[parameters.length - 1];
    expect(lastParam).toBe('Old title');
  });

  test('isVersion column — SET version+1 and WHERE AND version = current', () => {
    const versionCol: ColumnMetadata = {
      propertyName: 'version',
      columnName: 'version',
      type: 'INT',
      isVersion: true,
      isConcurrencyToken: true
    } as ColumnMetadata;
    const meta: EntityMetadata = {
      tableName: 'articles',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata,
        { propertyName: 'title', columnName: 'title', type: 'TEXT' } as ColumnMetadata,
        versionCol
      ]
    } as EntityMetadata;
    const entity = { id: 1, title: 'Hello', version: 3 };
    const { sql, parameters } = dialect.buildUpdate(entity, meta, versionCol);
    expect(sql).toContain('"version" = "version" + 1');
    expect(sql).toContain('AND "version" =');
    expect(parameters[parameters.length - 1]).toBe(3);
  });
});

describe('PostgresDialect — buildDelete with concurrency tokens', () => {
  test('no concurrency tokens — standard DELETE', () => {
    const meta: EntityMetadata = {
      tableName: 'articles',
      primaryKeys: ['id'],
      columns: [
        { propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true } as ColumnMetadata
      ]
    } as EntityMetadata;
    const entity = { id: 1 };
    const { sql } = dialect.buildDelete(entity, meta);
    expect(sql).toBe('DELETE FROM "articles" WHERE "id" = $1');
  });

  test('isConcurrencyToken — appends AND col = $N', () => {
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
    const original = { id: 1, title: 'Original title' };
    const { sql, parameters } = dialect.buildDelete(entity, meta, [titleCol], original);
    expect(sql).toContain('AND "title" = $2');
    expect(parameters[1]).toBe('Original title');
  });
});
