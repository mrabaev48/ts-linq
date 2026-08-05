import type { SqlQueryExecutor } from '@ts-linq/types';

import { PostgresDbIntrospector } from '../introspector';

function makeProvider(responses: Record<string, unknown[]>): SqlQueryExecutor {
  return {
    executeQuery: jest.fn(async (sql: string) => {
      for (const [key, rows] of Object.entries(responses)) {
        if (sql.includes(key)) return rows;
      }
      return [];
    })
  } as SqlQueryExecutor;
}

describe('PostgresDbIntrospector', () => {
  it('introspects tables with columns, PKs, FKs, and indexes', async () => {
    const provider = makeProvider({
      pg_tables: [{ tablename: 'orders' }],
      'information_schema.columns': [
        {
          column_name: 'id',
          udt_name: 'int4',
          data_type: 'integer',
          is_nullable: 'NO',
          column_default: "nextval('orders_id_seq')"
        },
        {
          column_name: 'user_id',
          udt_name: 'int4',
          data_type: 'integer',
          is_nullable: 'NO',
          column_default: null
        }
      ],
      'PRIMARY KEY': [{ column_name: 'id' }],
      referential_constraints: [
        {
          constraint_name: 'fk_order_user',
          column_name: 'user_id',
          foreign_table_name: 'users',
          foreign_column_name: 'id',
          delete_rule: 'NO ACTION'
        }
      ],
      pg_indexes: [
        {
          indexname: 'idx_orders_user_id',
          indexdef: 'CREATE INDEX idx_orders_user_id ON public.orders (user_id)'
        }
      ]
    });

    const introspector = new PostgresDbIntrospector(provider);
    const model = await introspector.introspect('public');

    expect(model.tables).toHaveLength(1);
    const table = model.tables[0];
    expect(table.name).toBe('orders');
    expect(table.primaryKeys).toEqual(['id']);

    const idCol = table.columns.find((c) => c.name === 'id')!;
    expect(idCol.ormType).toBe('INTEGER');
    expect(idCol.isIdentity).toBe(true);

    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0].referencedTable).toBe('users');

    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0].name).toBe('idx_orders_user_id');
    expect(table.indexes[0].columns).toEqual(['user_id']);
  });

  it('excludes _pkey indexes', async () => {
    const provider = makeProvider({
      pg_tables: [{ tablename: 'users' }],
      'information_schema.columns': [
        {
          column_name: 'id',
          udt_name: 'int4',
          data_type: 'integer',
          is_nullable: 'NO',
          column_default: null
        }
      ],
      'PRIMARY KEY': [{ column_name: 'id' }],
      referential_constraints: [],
      pg_indexes: [
        { indexname: 'users_pkey', indexdef: 'CREATE UNIQUE INDEX users_pkey ON public.users (id)' }
      ]
    });

    const introspector = new PostgresDbIntrospector(provider);
    const model = await introspector.introspect();
    expect(model.tables[0].indexes).toHaveLength(0);
  });
});
