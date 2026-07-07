/**
 * Per-dialect "golden" expectations for {@link runDdlStrategyContract}.
 *
 * The contract *inputs* (the case matrix) are shared and defined once in `cases.ts`; only the
 * dialect-specific *outputs* live here as data, keyed by case id per DDL operation. This is the
 * golden-master half of the parameterized DDL contract test — the DDL mirror of the SQL dialect
 * contract (see `runSqlDialectContract`). It is the safety net that makes the DDL dedup refactor
 * (task-7) safe: any structural drift in a dialect's DDL surfaces as a golden diff.
 *
 * Every case id declared in `cases.ts` must have a matching entry in the corresponding map; the
 * runner enforces this with a completeness guard so a missing golden fails loudly.
 */
export interface DdlStrategyContractGolden {
  createTable: Readonly<Record<string, string>>;
  columnDefinition: Readonly<Record<string, string>>;
  createIndex: Readonly<Record<string, string>>;
  addColumn: Readonly<Record<string, string>>;
  dropColumn: Readonly<Record<string, string>>;
  alterColumnType: Readonly<Record<string, string>>;
  renameTable: Readonly<Record<string, string>>;
  foreignKey: Readonly<Record<string, string>>;
  addUniqueConstraint: Readonly<Record<string, string>>;
  dropUniqueConstraint: Readonly<Record<string, string>>;
  /** Comment statements are a list (a dialect that inlines comments returns `[]`). */
  comment: Readonly<Record<string, readonly string[]>>;
}
