import type { SqlDialectContractGolden } from '@ts-linq/testkits';

/**
 * Golden expectations for {@link PostgresDialect}, captured from current behaviour. Divergences from
 * the other dialects (empty `GROUP BY` emitted, computed column excluded from INSERT, single-statement
 * batch UPDATE) are encoded here as-is; convergence is the job of later dialect dedup tasks.
 */
export const pgGolden: SqlDialectContractGolden = {
  parameterLimit: 65535,
  select: {
    star: { query: 'SELECT * FROM "test_table"', parameters: [] },
    columns: { query: 'SELECT id, name FROM "test_table"', parameters: [] },
    distinct: { query: 'SELECT DISTINCT name FROM "test_table"', parameters: [] },
    'where-single': { query: 'SELECT * FROM "test_table" WHERE id = $1', parameters: [1] },
    'where-multi': {
      query: 'SELECT * FROM "test_table" WHERE id > $1 AND name LIKE $2',
      parameters: [10, '%test%']
    },
    'join-inner': {
      query: 'SELECT * FROM "test_table" INNER JOIN "orders" ON orders.user_id = test_table.id',
      parameters: []
    },
    'order-by': { query: 'SELECT * FROM "test_table" ORDER BY name ASC, id DESC', parameters: [] },
    'group-having': {
      query: 'SELECT * FROM "test_table" GROUP BY name HAVING COUNT(*) > $1',
      parameters: [5]
    },
    // Empty GROUP BY columns are guarded out across all dialects (shared emitGroup guard).
    'group-empty': { query: 'SELECT * FROM "test_table"', parameters: [] },
    'limit-offset': { query: 'SELECT * FROM "test_table" LIMIT 10 OFFSET 20', parameters: [] },
    combined: {
      query:
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM "test_table" LEFT JOIN "orders" AS o ON o.user_id = test_table.id WHERE test_table.name LIKE $1 GROUP BY test_table.id, test_table.name ORDER BY order_count DESC LIMIT 10 OFFSET 5',
      parameters: ['%user%']
    }
  },
  insert: {
    basic: {
      sql: 'INSERT INTO "users" ("name","email") VALUES ($1,$2) RETURNING *',
      parameters: ['Alice', 'a@a.com']
    },
    // Divergence: PG excludes the computed column from INSERT.
    'computed-col': {
      sql: 'INSERT INTO "users" ("name") VALUES ($1) RETURNING *',
      parameters: ['Alice']
    },
    'supplied-pk': {
      sql: 'INSERT INTO "users" ("id","name","email") VALUES ($1,$2,$3) RETURNING *',
      parameters: [99, 'Alice', 'a@a.com']
    }
  },
  update: {
    'no-token': {
      sql: 'UPDATE "articles" SET "title" = $1 WHERE "id" = $2',
      parameters: ['Hello', 1]
    },
    'nonversion-token': {
      sql: 'UPDATE "articles" SET "title" = $1 WHERE "id" = $2 AND "title" = $3',
      parameters: ['New title', 1, 'Old title']
    },
    version: {
      sql: 'UPDATE "articles" SET "title" = $1, "version" = $2, "version" = "version" + 1 WHERE "id" = $3 AND "version" = $4',
      parameters: ['Hello', 3, 1, 3]
    }
  },
  delete: {
    'no-token': { sql: 'DELETE FROM "articles" WHERE "id" = $1', parameters: [1] },
    token: {
      sql: 'DELETE FROM "articles" WHERE "id" = $1 AND "title" = $2',
      parameters: [1, 'Original title']
    }
  },
  bulkUpdate: {
    basic: { sql: 'UPDATE "users" SET "name" = $1 WHERE id = $2', parameters: ['Alice', 1] }
  },
  bulkDelete: {
    basic: { sql: 'DELETE FROM "users" WHERE id = $1', parameters: [1] }
  },
  batchInsert: {
    basic: {
      sql: 'INSERT INTO "users" ("name","email") VALUES ($1,$2),($3,$4) RETURNING *',
      parameters: ['Alice', 'a@a.com', 'Bob', 'b@b.com']
    },
    'supplied-pk': {
      sql: 'INSERT INTO "users" ("id","name","email") VALUES ($1,$2,$3) RETURNING *',
      parameters: [99, 'X', 'x@x.com']
    },
    'nongenerated-pk': {
      sql: 'INSERT INTO "users" ("id","name","email") VALUES ($1,$2,$3) RETURNING *',
      parameters: [5, 'X', 'x@x.com']
    }
  },
  batchUpdate: {
    // Divergence: PG returns a single CTE statement (MySQL returns per-row statements[]).
    basic: {
      sql: 'WITH _batch("id","name","email") AS (VALUES ($1,$2,$3),($4,$5,$6)) UPDATE "users" SET "name"=_batch."name"::text,"email"=_batch."email"::text FROM _batch WHERE "users"."id"=_batch."id"::integer',
      parameters: [1, 'Alice', 'a@a.com', 2, 'Bob', 'b@b.com']
    }
  },
  batchDelete: {
    basic: { sql: 'DELETE FROM "users" WHERE "id" IN ($1,$2,$3)', parameters: [1, 2, 3] }
  }
};
