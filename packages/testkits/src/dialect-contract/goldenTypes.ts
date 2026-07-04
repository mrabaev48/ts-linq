import type {
  BatchInsertResult,
  BatchUpdateResult,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning
} from '@ts-linq/types';

/**
 * Per-dialect "golden" expectations for {@link runSqlDialectContract}.
 *
 * The contract *inputs* (the case matrix) are shared and defined once in `cases.ts`; only the
 * dialect-specific *outputs* live here as data, keyed by case id. This is the golden-master half of
 * the parameterized contract test: the structure is shared, the tokens (placeholder style,
 * identifier quoting, clause guards) differ per dialect and are captured as-is.
 *
 * Every case id declared in `cases.ts` must have a matching entry in the corresponding map; the
 * runner enforces this with a completeness guard so a missing golden fails loudly instead of
 * silently skipping coverage.
 */
export interface SqlDialectContractGolden {
  /** Expected `dialect.parameterLimit` (e.g. PG 65535, MSSQL 2100). */
  parameterLimit: number;
  /** `buildSelect` expectations, keyed by select-case id. */
  select: Readonly<Record<string, SqlQueryResult>>;
  /** `buildInsert` expectations, keyed by insert-case id. */
  insert: Readonly<Record<string, SqlWithReturning>>;
  /** `buildUpdate` expectations, keyed by update-case id. */
  update: Readonly<Record<string, SqlWithParams>>;
  /** `buildDelete` expectations, keyed by delete-case id. */
  delete: Readonly<Record<string, SqlWithParams>>;
  /** `buildBulkUpdate` expectations, keyed by bulk-update-case id. */
  bulkUpdate: Readonly<Record<string, SqlWithParams>>;
  /** `buildBulkDelete` expectations, keyed by bulk-delete-case id. */
  bulkDelete: Readonly<Record<string, SqlWithParams>>;
  /** `buildBatchInsert` expectations, keyed by batch-insert-case id. */
  batchInsert: Readonly<Record<string, BatchInsertResult>>;
  /** `buildBatchUpdate` expectations, keyed by batch-update-case id. */
  batchUpdate: Readonly<Record<string, BatchUpdateResult>>;
  /** `buildBatchDelete` expectations, keyed by batch-delete-case id. */
  batchDelete: Readonly<Record<string, SqlWithParams>>;
}
