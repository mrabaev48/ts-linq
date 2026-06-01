import type { DatabaseProvider } from '@ts-linq/core';

import { MySqlDbIntrospector } from '../introspector';

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

describe('MySqlDbIntrospector', () => {
  it('introspects tables with columns, PKs, FKs, and indexes', async () => {
    const provider = makeProvider({
      'information_schema.tables': [{ TABLE_NAME: 'products' }],
      COLUMN_TYPE: [
        {
          COLUMN_NAME: 'id',
          COLUMN_TYPE: 'int(11)',
          DATA_TYPE: 'int',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null,
          EXTRA: 'auto_increment'
        },
        {
          COLUMN_NAME: 'name',
          COLUMN_TYPE: 'varchar(255)',
          DATA_TYPE: 'varchar',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null,
          EXTRA: ''
        }
      ],
      "COLUMN_KEY = 'PRI'": [{ COLUMN_NAME: 'id' }],
      referential_constraints: [],
      'information_schema.statistics': []
    });

    const introspector = new MySqlDbIntrospector(provider);
    const model = await introspector.introspect();

    expect(model.tables).toHaveLength(1);
    const table = model.tables[0];
    expect(table.name).toBe('products');
    expect(table.primaryKeys).toEqual(['id']);

    const idCol = table.columns.find((c) => c.name === 'id')!;
    expect(idCol.isIdentity).toBe(true);
    expect(idCol.ormType).toBe('INTEGER');
  });

  it('maps tinyint(1) to BOOLEAN', async () => {
    const provider = makeProvider({
      'information_schema.tables': [{ TABLE_NAME: 'flags' }],
      COLUMN_TYPE: [
        {
          COLUMN_NAME: 'active',
          COLUMN_TYPE: 'tinyint(1)',
          DATA_TYPE: 'tinyint',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null,
          EXTRA: ''
        }
      ],
      "COLUMN_KEY = 'PRI'": [],
      referential_constraints: [],
      'information_schema.statistics': []
    });

    const introspector = new MySqlDbIntrospector(provider);
    const model = await introspector.introspect();
    const col = model.tables[0].columns[0];
    expect(col.ormType).toBe('BOOLEAN');
  });
});
