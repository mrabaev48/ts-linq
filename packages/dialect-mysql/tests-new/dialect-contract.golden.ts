import type { SqlDialectContractGolden } from '@ts-linq/testkits';

/**
 * Golden expectations for {@link MysqlDialect}, captured from current behaviour. Divergences from the
 * other dialects (empty `GROUP BY` emitted, computed column excluded from INSERT, per-row batch UPDATE
 * `statements[]`, `LAST_INSERT_ID` PK writeback) are encoded here as-is; convergence is the job of
 * later dialect dedup tasks.
 *
 * task-3 (centralize quoting): CRUD identifiers are now backtick-quoted (`` `users` ``, `` `title` ``),
 * where INSERT/UPDATE/DELETE previously emitted bare, unquoted identifiers. This is the intended
 * security fix (identifier break-out closed); the escaped output is the new golden.
 */
export const mysqlGolden: SqlDialectContractGolden = {
  parameterLimit: 65535,
  select: {
    star: { query: 'SELECT * FROM `test_table`', parameters: [] },
    columns: { query: 'SELECT id, name FROM `test_table`', parameters: [] },
    distinct: { query: 'SELECT DISTINCT name FROM `test_table`', parameters: [] },
    'where-single': { query: 'SELECT * FROM `test_table` WHERE id = ?', parameters: [1] },
    'where-multi': {
      query: 'SELECT * FROM `test_table` WHERE id > ? AND name LIKE ?',
      parameters: [10, '%test%']
    },
    'join-inner': {
      query: 'SELECT * FROM `test_table` INNER JOIN `orders` ON orders.user_id = test_table.id',
      parameters: []
    },
    'order-by': { query: 'SELECT * FROM `test_table` ORDER BY name ASC, id DESC', parameters: [] },
    'group-having': {
      query: 'SELECT * FROM `test_table` GROUP BY name HAVING COUNT(*) > ?',
      parameters: [5]
    },
    // Divergence: MySQL emits a bare trailing ` GROUP BY ` for empty columns (MSSQL guards it out).
    'group-empty': { query: 'SELECT * FROM `test_table` GROUP BY ', parameters: [] },
    'limit-offset': { query: 'SELECT * FROM `test_table` LIMIT 10 OFFSET 20', parameters: [] },
    combined: {
      query:
        'SELECT DISTINCT test_table.id, test_table.name, COUNT(o.id) AS order_count FROM `test_table` LEFT JOIN `orders` AS o ON o.user_id = test_table.id WHERE test_table.name LIKE ? GROUP BY test_table.id, test_table.name ORDER BY order_count DESC LIMIT 10 OFFSET 5',
      parameters: ['%user%']
    }
  },
  insert: {
    basic: {
      sql: 'INSERT INTO `users` (`name`, `email`) VALUES (?, ?)',
      parameters: ['Alice', 'a@a.com']
    },
    // Divergence: MySQL excludes the computed column from INSERT.
    'computed-col': { sql: 'INSERT INTO `users` (`name`) VALUES (?)', parameters: ['Alice'] },
    'supplied-pk': {
      sql: 'INSERT INTO `users` (`id`, `name`, `email`) VALUES (?, ?, ?)',
      parameters: [99, 'Alice', 'a@a.com']
    }
  },
  update: {
    'no-token': {
      sql: 'UPDATE `articles` SET `title` = ? WHERE `id` = ?',
      parameters: ['Hello', 1]
    },
    'nonversion-token': {
      sql: 'UPDATE `articles` SET `title` = ? WHERE `id` = ? AND `title` = ?',
      parameters: ['New title', 1, 'Old title']
    },
    version: {
      sql: 'UPDATE `articles` SET `title` = ?, `version` = ?, `version` = `version` + 1 WHERE `id` = ? AND `version` = ?',
      parameters: ['Hello', 3, 1, 3]
    }
  },
  delete: {
    'no-token': { sql: 'DELETE FROM `articles` WHERE `id` = ?', parameters: [1] },
    token: {
      sql: 'DELETE FROM `articles` WHERE `id` = ? AND `title` = ?',
      parameters: [1, 'Original title']
    }
  },
  bulkUpdate: {
    basic: { sql: 'UPDATE `users` SET `name` = ? WHERE id = ?', parameters: ['Alice', 1] }
  },
  bulkDelete: {
    basic: { sql: 'DELETE FROM `users` WHERE id = ?', parameters: [1] }
  },
  batchInsert: {
    // Divergence: MySQL cannot return rows inline; PK writeback via LAST_INSERT_ID.
    basic: {
      sql: 'INSERT INTO `users` (`name`,`email`) VALUES (?,?),(?,?)',
      parameters: ['Alice', 'a@a.com', 'Bob', 'b@b.com'],
      returnsRows: false,
      fetchFirstInsertIdSql: 'SELECT LAST_INSERT_ID() AS first_id'
    },
    'supplied-pk': {
      sql: 'INSERT INTO `users` (`id`,`name`,`email`) VALUES (?,?,?)',
      parameters: [99, 'X', 'x@x.com'],
      returnsRows: false,
      fetchFirstInsertIdSql: 'SELECT LAST_INSERT_ID() AS first_id'
    },
    'nongenerated-pk': {
      sql: 'INSERT INTO `users` (`id`,`name`,`email`) VALUES (?,?,?)',
      parameters: [5, 'X', 'x@x.com'],
      returnsRows: false,
      fetchFirstInsertIdSql: 'SELECT LAST_INSERT_ID() AS first_id'
    }
  },
  batchUpdate: {
    // Divergence: MySQL returns per-row statements[] (PG/MSSQL return a single statement).
    basic: {
      statements: [
        {
          sql: 'UPDATE `users` SET `name`=?,`email`=? WHERE `id`=?',
          parameters: ['Alice', 'a@a.com', 1]
        },
        {
          sql: 'UPDATE `users` SET `name`=?,`email`=? WHERE `id`=?',
          parameters: ['Bob', 'b@b.com', 2]
        }
      ]
    }
  },
  batchDelete: {
    basic: { sql: 'DELETE FROM `users` WHERE `id` IN (?,?,?)', parameters: [1, 2, 3] }
  }
};
