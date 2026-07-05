import type {
  BatchInsertResult,
  BatchUpdateResult,
  QueryOptions,
  SqlDialect,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning
} from '@ts-linq/types';

import {
  batchMeta,
  batchNonGeneratedPkMeta,
  ContractEntity,
  insertComputedMeta,
  insertMeta,
  titleToken,
  tokenMeta,
  versionColumn,
  versionMeta,
  writeMeta
} from './fixtures';

/**
 * A single contract case: a stable `id` (used to look up the golden expectation) and how to invoke
 * the dialect to produce the actual result. The inputs are baked into the closure so every dialect
 * receives byte-identical arguments.
 */
export interface ContractCase<R> {
  readonly id: string;
  invoke(dialect: SqlDialect): R;
}

// The contract methods below are optional on `SqlDialect` but always implemented by real dialects;
// they are invoked as methods (`d.buildX!(...)`) so `this` is preserved.

// ── SELECT ─────────────────────────────────────────────────────────────────────────────────────

const selectInputs: ReadonlyArray<readonly [string, QueryOptions]> = [
  ['star', {}],
  ['columns', { select: ['id', 'name'] }],
  ['distinct', { distinct: true, select: ['name'] }],
  ['where-single', { where: { condition: 'id = ?', parameters: [1] } }],
  [
    'where-multi',
    {
      where: [
        { condition: 'id > ?', parameters: [10] },
        { condition: 'name LIKE ?', parameters: ['%test%'] }
      ]
    }
  ],
  [
    'join-inner',
    { joins: [{ type: 'INNER', table: 'orders', on: 'orders.user_id = test_table.id' }] }
  ],
  [
    'order-by',
    {
      orderBy: [
        { column: 'name', direction: 'ASC' },
        { column: 'id', direction: 'DESC' }
      ]
    }
  ],
  [
    'group-having',
    { groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [5] } } }
  ],
  // All dialects guard empty GROUP BY columns (shared emitGroup guard) — no dangling ` GROUP BY `.
  ['group-empty', { groupBy: { columns: [] } }],
  ['limit-offset', { limit: 10, offset: 20 }],
  [
    'combined',
    {
      distinct: true,
      select: ['test_table.id', 'test_table.name', 'COUNT(o.id) AS order_count'],
      joins: [{ type: 'LEFT', table: 'orders', alias: 'o', on: 'o.user_id = test_table.id' }],
      where: [{ condition: 'test_table.name LIKE ?', parameters: ['%user%'] }],
      groupBy: { columns: ['test_table.id', 'test_table.name'] },
      orderBy: [{ column: 'order_count', direction: 'DESC' }],
      limit: 10,
      offset: 5
    }
  ]
];

export const selectCases: ReadonlyArray<ContractCase<SqlQueryResult>> = selectInputs.map(
  ([id, options]) => ({ id, invoke: (dialect) => dialect.buildSelect(ContractEntity, options) })
);

// ── INSERT ───────────────────────────────────────────────────────────────────────────────────

export const insertCases: ReadonlyArray<ContractCase<SqlWithReturning>> = [
  {
    id: 'basic',
    invoke: (d) => d.buildInsert!({ name: 'Alice', email: 'a@a.com' }, insertMeta)
  },
  {
    // Reconciled (task-4): every dialect now excludes the computed column from INSERT.
    id: 'computed-col',
    invoke: (d) => d.buildInsert!({ name: 'Alice', fullName: 'ignored' }, insertComputedMeta)
  },
  {
    id: 'supplied-pk',
    invoke: (d) => d.buildInsert!({ id: 99, name: 'Alice', email: 'a@a.com' }, insertMeta)
  }
];

// ── UPDATE ───────────────────────────────────────────────────────────────────────────────────

export const updateCases: ReadonlyArray<ContractCase<SqlWithParams>> = [
  {
    id: 'no-token',
    invoke: (d) => d.buildUpdate!({ id: 1, title: 'Hello' }, writeMeta)
  },
  {
    id: 'nonversion-token',
    invoke: (d) =>
      d.buildUpdate!({ id: 1, title: 'New title' }, tokenMeta, undefined, [titleToken], {
        id: 1,
        title: 'Old title'
      })
  },
  {
    id: 'version',
    invoke: (d) => d.buildUpdate!({ id: 1, title: 'Hello', version: 3 }, versionMeta, versionColumn)
  }
];

// ── DELETE ───────────────────────────────────────────────────────────────────────────────────

export const deleteCases: ReadonlyArray<ContractCase<SqlWithParams>> = [
  {
    id: 'no-token',
    invoke: (d) => d.buildDelete!({ id: 1, title: 'Hello' }, writeMeta)
  },
  {
    id: 'token',
    invoke: (d) =>
      d.buildDelete!({ id: 1, title: 'Hello' }, tokenMeta, [titleToken], {
        id: 1,
        title: 'Original title'
      })
  }
];

// ── BULK ─────────────────────────────────────────────────────────────────────────────────────

export const bulkUpdateCases: ReadonlyArray<ContractCase<SqlWithParams>> = [
  {
    id: 'basic',
    invoke: (d) =>
      d.buildBulkUpdate!({
        tableName: 'users',
        setters: [{ columnName: 'name', value: { kind: 'literal', params: ['Alice'] } }],
        where: [{ condition: 'id = ?', parameters: [1] }]
      })
  }
];

export const bulkDeleteCases: ReadonlyArray<ContractCase<SqlWithParams>> = [
  {
    id: 'basic',
    invoke: (d) =>
      d.buildBulkDelete!({
        tableName: 'users',
        where: [{ condition: 'id = ?', parameters: [1] }]
      })
  }
];

// ── BATCH ────────────────────────────────────────────────────────────────────────────────────

const batchEntities = [
  { name: 'Alice', email: 'a@a.com' },
  { name: 'Bob', email: 'b@b.com' }
];

export const batchInsertCases: ReadonlyArray<ContractCase<BatchInsertResult>> = [
  {
    id: 'basic',
    invoke: (d) => d.buildBatchInsert!(batchEntities, batchMeta)
  },
  {
    id: 'supplied-pk',
    invoke: (d) => d.buildBatchInsert!([{ id: 99, name: 'X', email: 'x@x.com' }], batchMeta)
  },
  {
    // MSSQL omits OUTPUT when the PK is not generated.
    id: 'nongenerated-pk',
    invoke: (d) =>
      d.buildBatchInsert!([{ id: 5, name: 'X', email: 'x@x.com' }], batchNonGeneratedPkMeta)
  }
];

export const batchUpdateCases: ReadonlyArray<ContractCase<BatchUpdateResult>> = [
  {
    // Divergence: PG/MSSQL return a single `sql`; MySQL returns per-row `statements[]`.
    id: 'basic',
    invoke: (d) =>
      d.buildBatchUpdate!(
        [
          { id: 1, name: 'Alice', email: 'a@a.com' },
          { id: 2, name: 'Bob', email: 'b@b.com' }
        ],
        batchMeta
      )
  }
];

export const batchDeleteCases: ReadonlyArray<ContractCase<SqlWithParams>> = [
  {
    id: 'basic',
    invoke: (d) => d.buildBatchDelete!([{ id: 1 }, { id: 2 }, { id: 3 }], batchMeta)
  }
];
