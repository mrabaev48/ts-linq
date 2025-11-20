import { QueryBuilder } from '@ts-linq/query';
import type { QueryOptions } from '@ts-linq/types';
import { MetadataStorage } from '@ts-linq/metadata';
import { PostgresDialect } from '@ts-linq/dialect-postgres';

class PgUser {
  id!: number;
  name!: string;
  age!: number;
  createdAt!: Date;
}

describe('PostgreSQL SQL snapshots (dialect-level, no DB required)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(PgUser, 'pg_users');
    MetadataStorage.addColumn(PgUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(PgUser, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(PgUser, {
      propertyName: 'age',
      columnName: 'age',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(PgUser, {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'TIMESTAMP',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(PgUser, 'id');
  });

  test('SELECT with JSONB path and Full-Text Search snapshot', () => {
    const dialect = new PostgresDialect();
    const opts: QueryOptions = {
      select: [
        'jsonb_path_query_first(data, ?) AS jval',
        "ts_rank(to_tsvector(?, COALESCE(name, '') || ' ' || COALESCE(CAST(age AS TEXT), '')), websearch_to_tsquery(?, ?)) AS score"
      ],
      selectParams: ['$.a[0].b', 'simple', 'simple', 'typescript postgres'],
      where: [{ condition: 'data @> ?', parameters: [{ tag: 'db' }] }],
      orderBy: [{ column: 'score', direction: 'DESC' }],
      limit: 5
    } as any;
    const built = dialect.buildSelect(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [
          "$.a[0].b",
          "simple",
          "simple",
          "typescript postgres",
          {
            "tag": "db",
          },
        ],
        "query": "SELECT jsonb_path_query_first(data, $1) AS jval, ts_rank(to_tsvector($2, COALESCE(name, '') || ' ' || COALESCE(CAST(age AS TEXT), '')), websearch_to_tsquery($3, $4)) AS score FROM \"pg_users\" WHERE data @> $5 ORDER BY score DESC LIMIT 5",
      }
    `);
  });

  test('SELECT with WHERE/ORDER/LIMIT/OFFSET snapshot', () => {
    const qb = new QueryBuilder(new PostgresDialect());
    const opts: QueryOptions = {
      select: ['id', 'name', 'age'],
      where: [
        { condition: 'age > ?', parameters: [18] },
        { condition: 'name <> ?', parameters: ['john'] }
      ],
      orderBy: [
        { column: 'age', direction: 'DESC' },
        { column: 'id', direction: 'ASC' }
      ],
      limit: 10,
      offset: 5
    } as any;
    const built = qb.generateSql(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
     {
       "parameters": [
         18,
         "john",
       ],
       "query": "SELECT id, name, age FROM "pg_users" WHERE age > $1 AND name <> $2 ORDER BY age DESC, id ASC LIMIT 10 OFFSET 5",
     }
    `);
  });

  test('SELECT with CTE and GROUP BY/HAVING snapshot', () => {
    const qb = new QueryBuilder(new PostgresDialect());
    const opts: QueryOptions = {
      select: ['name', 'COUNT(*) AS cnt'],
      groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [1] } },
      cte: { name: 'active_users', sql: 'SELECT * FROM "pg_users" WHERE age > 18' },
      from: 'active_users'
    } as any;
    const built = qb.generateSql(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
     {
       "parameters": [
         1,
       ],
       "query": "WITH active_users AS (SELECT * FROM "pg_users" WHERE age > 18) SELECT name, COUNT(*) AS cnt FROM "active_users" GROUP BY name HAVING COUNT(*) > $1",
     }
    `);
  });

  test('OFFSET without LIMIT snapshot', () => {
    const qb = new QueryBuilder(new PostgresDialect());
    const opts: QueryOptions = {
      select: ['id', 'name'],
      where: [{ condition: 'age >= ?', parameters: [21] }],
      offset: 7
    } as any;
    const built = qb.generateSql(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [
          21,
        ],
        "query": "SELECT id, name FROM \"pg_users\" WHERE age >= $1 OFFSET 7",
      }
    `);
  });

  test('WHERE with EXISTS subquery snapshot', () => {
    const qb = new QueryBuilder(new PostgresDialect());
    const opts: QueryOptions = {
      select: ['id'],
      where: [
        {
          condition: 'EXISTS (SELECT 1 FROM "orders" o WHERE o.user_id = id AND o.amount > ?)',
          parameters: [100]
        }
      ]
    } as any;
    const built = qb.generateSql(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [
          100,
        ],
        "query": "SELECT id FROM \"pg_users\" WHERE EXISTS (SELECT 1 FROM \"orders\" o WHERE o.user_id = id AND o.amount > $1)",
      }
    `);
  });

  test('Window function row_number() snapshot', () => {
    const qb = new QueryBuilder(new PostgresDialect());
    const opts: QueryOptions = {
      select: ['row_number() OVER (PARTITION BY name ORDER BY age DESC) AS rn', 'id', 'name', 'age']
    } as any;
    const built = qb.generateSql(PgUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
     {
       "parameters": [],
       "query": "SELECT row_number() OVER (PARTITION BY name ORDER BY age DESC) AS rn, id, name, age FROM "pg_users"",
     }
    `);
  });
});
