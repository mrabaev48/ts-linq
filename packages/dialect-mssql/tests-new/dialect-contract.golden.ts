import type { SqlDialectContractGolden } from '@ts-linq/testkits';

/**
 * Golden expectations for {@link MssqlDialect}, captured from current behaviour. Remaining divergences
 * from the other dialects (empty `GROUP BY` guarded out, OFFSET/FETCH paging, single-statement batch
 * UPDATE via VALUES JOIN) are encoded here as-is. The former computed-column INSERT divergence was
 * reconciled in task-4 — computed columns are now excluded from INSERT on every dialect.
 *
 * task-3 (centralize quoting): CRUD identifiers are now bracket-quoted (`[users]`, `[title]`), where
 * INSERT/UPDATE/DELETE previously emitted bare, unquoted identifiers. This is the intended security
 * fix (identifier break-out closed); the escaped output is the new golden.
 */
export const mssqlGolden: SqlDialectContractGolden = {
  parameterLimit: 2100,
  select: {
    star: { query: 'SELECT * FROM [test_table]', parameters: [] },
    columns: { query: 'SELECT id, name FROM [test_table]', parameters: [] },
    distinct: { query: 'SELECT DISTINCT name FROM [test_table]', parameters: [] },
    'where-single': { query: 'SELECT * FROM [test_table] WHERE id = @p1', parameters: [1] },
    'where-multi': {
      query: 'SELECT * FROM [test_table] WHERE id > @p1 AND name LIKE @p2',
      parameters: [10, '%test%']
    },
    'join-inner': {
      query: 'SELECT * FROM [test_table] INNER JOIN [orders] ON orders.user_id = test_table.id',
      parameters: []
    },
    'order-by': { query: 'SELECT * FROM [test_table] ORDER BY name ASC, id DESC', parameters: [] },
    'group-having': {
      query: 'SELECT * FROM [test_table] GROUP BY name HAVING COUNT(*) > @p1',
      parameters: [5]
    },
    // Divergence: MSSQL guards empty GROUP BY columns — no clause emitted (PG/MySQL emit a bare one).
    'group-empty': { query: 'SELECT * FROM [test_table]', parameters: [] },
    // Divergence: MSSQL pages via OFFSET/FETCH and synthesises an ORDER BY when none is given.
    'limit-offset': {
      query:
        'SELECT * FROM [test_table] ORDER BY (SELECT NULL) OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY',
      parameters: []
    },
    combined: {
      query:
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM [test_table] LEFT JOIN [orders] AS o ON o.user_id = test_table.id WHERE test_table.name LIKE @p1 GROUP BY test_table.id, test_table.name ORDER BY order_count DESC OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY',
      parameters: ['%user%']
    }
  },
  insert: {
    basic: {
      sql: 'INSERT INTO [users] ([name], [email]) OUTPUT INSERTED.[id] AS id VALUES (@p1, @p2)',
      parameters: ['Alice', 'a@a.com'],
      returningPk: 'id'
    },
    // Reconciled (task-4): the computed column is now excluded from INSERT on every dialect, fixing
    // the former MSSQL-only latent bug. Uniform with the MySQL/PG goldens.
    'computed-col': {
      sql: 'INSERT INTO [users] ([name]) OUTPUT INSERTED.[id] AS id VALUES (@p1)',
      parameters: ['Alice'],
      returningPk: 'id'
    },
    'supplied-pk': {
      sql: 'INSERT INTO [users] ([id], [name], [email]) OUTPUT INSERTED.[id] AS id VALUES (@p1, @p2, @p3)',
      parameters: [99, 'Alice', 'a@a.com'],
      returningPk: 'id'
    }
  },
  update: {
    'no-token': {
      sql: 'UPDATE [articles] SET [title] = @p1 WHERE [id] = @p2',
      parameters: ['Hello', 1]
    },
    'nonversion-token': {
      sql: 'UPDATE [articles] SET [title] = @p1 WHERE [id] = @p2 AND [title] = @p3',
      parameters: ['New title', 1, 'Old title']
    },
    version: {
      sql: 'UPDATE [articles] SET [title] = @p1, [version] = @p2, [version] = [version] + 1 WHERE [id] = @p3 AND [version] = @p4',
      parameters: ['Hello', 3, 1, 3]
    }
  },
  delete: {
    'no-token': { sql: 'DELETE FROM [articles] WHERE [id] = @p1', parameters: [1] },
    token: {
      sql: 'DELETE FROM [articles] WHERE [id] = @p1 AND [title] = @p2',
      parameters: [1, 'Original title']
    }
  },
  bulkUpdate: {
    basic: { sql: 'UPDATE [users] SET [name] = @p1 WHERE id = @p2', parameters: ['Alice', 1] }
  },
  bulkDelete: {
    basic: { sql: 'DELETE FROM [users] WHERE id = @p1', parameters: [1] }
  },
  batchInsert: {
    basic: {
      sql: 'INSERT INTO [users] ([name],[email]) OUTPUT INSERTED.[id] AS id VALUES (@p1,@p2),(@p3,@p4)',
      parameters: ['Alice', 'a@a.com', 'Bob', 'b@b.com']
    },
    'supplied-pk': {
      sql: 'INSERT INTO [users] ([id],[name],[email]) OUTPUT INSERTED.[id] AS id VALUES (@p1,@p2,@p3)',
      parameters: [99, 'X', 'x@x.com']
    },
    // Divergence: MSSQL omits OUTPUT when the PK is not generated.
    'nongenerated-pk': {
      sql: 'INSERT INTO [users] ([id],[name],[email]) VALUES (@p1,@p2,@p3)',
      parameters: [5, 'X', 'x@x.com']
    }
  },
  batchUpdate: {
    // Divergence: MSSQL returns a single VALUES-JOIN statement (MySQL returns per-row statements[]).
    basic: {
      sql: 'UPDATE t SET t.[name]=b.[name],t.[email]=b.[email] FROM [users] t JOIN (VALUES (@p1,@p2,@p3),(@p4,@p5,@p6)) AS b([id],[name],[email]) ON t.[id]=b.[id]',
      parameters: [1, 'Alice', 'a@a.com', 2, 'Bob', 'b@b.com']
    }
  },
  batchDelete: {
    basic: { sql: 'DELETE FROM [users] WHERE [id] IN (@p1,@p2,@p3)', parameters: [1, 2, 3] }
  }
};
