import type { DatabaseProvider } from '@ts-linq/core';

import { MssqlDbIntrospector } from '../introspector';

function makeProvider(responses: Record<string, unknown[]>): DatabaseProvider {
  return {
    executeQuery: jest.fn(async (sql: string) => {
      for (const [key, rows] of Object.entries(responses)) {
        if (sql.includes(key)) return rows;
      }
      return [];
    }),
    connect: jest.fn(),
    disconnect: jest.fn()
  } as unknown as DatabaseProvider;
}

describe('MssqlDbIntrospector', () => {
  it('introspects tables with columns, PKs, FKs, and indexes', async () => {
    const provider = makeProvider({
      'INFORMATION_SCHEMA.TABLES': [{ TABLE_NAME: 'employees' }],
      'INFORMATION_SCHEMA.COLUMNS': [
        { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null },
        { COLUMN_NAME: 'name', DATA_TYPE: 'nvarchar', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null }
      ],
      'PRIMARY KEY': [{ COLUMN_NAME: 'id' }],
      'sys.identity_columns': [{ name: 'id' }],
      'sys.foreign_keys': [],
      'sys.indexes': [
        {
          index_name: 'idx_name',
          is_unique: false,
          col_name: 'name',
          is_desc: false,
          filter_def: null,
          key_ordinal: 1
        }
      ]
    });

    const introspector = new MssqlDbIntrospector(provider);
    const model = await introspector.introspect('dbo');

    expect(model.tables).toHaveLength(1);
    const table = model.tables[0];
    expect(table.name).toBe('employees');
    expect(table.primaryKeys).toEqual(['id']);

    const idCol = table.columns.find((c) => c.name === 'id')!;
    expect(idCol.isIdentity).toBe(true);
    expect(idCol.ormType).toBe('INTEGER');

    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0].name).toBe('idx_name');
  });

  it('maps uniqueidentifier to UUID', async () => {
    const provider = makeProvider({
      'INFORMATION_SCHEMA.TABLES': [{ TABLE_NAME: 'items' }],
      'INFORMATION_SCHEMA.COLUMNS': [
        {
          COLUMN_NAME: 'guid',
          DATA_TYPE: 'uniqueidentifier',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null
        }
      ],
      'PRIMARY KEY': [],
      'sys.identity_columns': [],
      'sys.foreign_keys': [],
      'sys.indexes': []
    });

    const introspector = new MssqlDbIntrospector(provider);
    const model = await introspector.introspect();
    const col = model.tables[0].columns[0];
    expect(col.ormType).toBe('UUID');
  });
});
