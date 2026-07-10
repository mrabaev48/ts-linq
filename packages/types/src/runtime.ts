// Runtime helpers — the only behaviour-carrying module in @ts-linq/types.
//
// Holds the package's trivial, pure, dependency-free runtime helpers: the
// `Result` constructors (`ok`/`err`), the `isTemplateSqlCache`/`maskSql` guards, and the
// dialect-capability assertion functions (`require*`). Most other modules are type-only; this one
// also value-imports the `OrmError` subclasses it throws.

import type { SqlCache, TemplateSqlCache } from './cache';
import type {
  SqlDialect,
  SupportsBatch,
  SupportsBulk,
  SupportsCrud,
  SupportsStoredProcedures,
  SupportsTemporal
} from './dialect';
import { TemporalNotSupportedError, UnsupportedOperationError } from './errors';
import type { Result } from './results';

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/** Type guard for TemplateSqlCache. */
export function isTemplateSqlCache(cache: SqlCache): cache is TemplateSqlCache {
  return typeof (cache as TemplateSqlCache).getTemplate === 'function';
}

/**
 * Redact string literals in a SQL statement so values never leak into traces/metrics.
 *
 * Replaces single- and double-quoted literals with `[REDACTED]`, then applies any
 * caller-supplied `patterns` (e.g. custom secret shapes). Invalid patterns are skipped
 * defensively — this function never throws, so it is always safe on a logging path.
 *
 * Pure and stateless: the single shared redaction unit consumed by every `SqlLogger`
 * implementation. Whether redaction is enabled is the caller's decision; this util
 * unconditionally redacts when called.
 */
export function maskSql(sql: string, patterns?: ReadonlyArray<RegExp>): string {
  let s = sql
    .replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
  for (const re of patterns ?? []) {
    try {
      s = s.replace(re, '[REDACTED]');
    } catch {
      // ignore invalid regex patterns
    }
  }
  return s;
}

function dialectLabel(dialect: SqlDialect): string {
  return dialect.constructor?.name ?? 'UnknownDialect';
}

/** Shared throw ceremony for the `require*` guards below — builds the descriptive message and the
 *  structured `details` payload so each guard's body is just its capability check. */
function throwUnsupportedCapability(
  dialect: SqlDialect,
  capability: string,
  methods: string
): never {
  throw new UnsupportedOperationError(
    `${dialectLabel(dialect)} does not support ${capability} operations (${methods}).`,
    { details: { capability, dialect: dialectLabel(dialect) } }
  );
}

/**
 * Assert a dialect supports single-row CRUD (`buildInsert`/`buildUpdate`/`buildDelete`), narrowing
 * it to `SqlDialect & SupportsCrud` for the rest of the call site. Prefers the declared
 * `capabilities.crud` flag; falls back to method-presence sniffing when `capabilities` is absent
 * (e.g. a test double), so existing `SqlDialect` implementers are unaffected.
 */
export function requireCrud(dialect: SqlDialect): asserts dialect is SqlDialect & SupportsCrud {
  const supported =
    dialect.capabilities?.crud ??
    (typeof dialect.buildInsert === 'function' &&
      typeof dialect.buildUpdate === 'function' &&
      typeof dialect.buildDelete === 'function');
  if (!supported)
    throwUnsupportedCapability(dialect, 'crud', 'buildInsert/buildUpdate/buildDelete');
}

/**
 * Assert a dialect supports multi-row batch INSERT/UPDATE/DELETE, narrowing it to
 * `SqlDialect & SupportsBatch`. See {@link requireCrud} for the capability/fallback strategy.
 */
export function requireBatch(dialect: SqlDialect): asserts dialect is SqlDialect & SupportsBatch {
  const supported =
    dialect.capabilities?.batch ??
    (typeof dialect.buildBatchInsert === 'function' &&
      typeof dialect.buildBatchUpdate === 'function' &&
      typeof dialect.buildBatchDelete === 'function');
  if (!supported)
    throwUnsupportedCapability(
      dialect,
      'batch',
      'buildBatchInsert/buildBatchUpdate/buildBatchDelete'
    );
}

/**
 * Assert a dialect supports bulk UPDATE/DELETE (`ExecuteUpdate`/`ExecuteDelete` parity), narrowing
 * it to `SqlDialect & SupportsBulk`. See {@link requireCrud} for the capability/fallback strategy.
 */
export function requireBulk(dialect: SqlDialect): asserts dialect is SqlDialect & SupportsBulk {
  const supported =
    dialect.capabilities?.bulk ??
    (typeof dialect.buildBulkUpdate === 'function' &&
      typeof dialect.buildBulkDelete === 'function');
  if (!supported) throwUnsupportedCapability(dialect, 'bulk', 'buildBulkUpdate/buildBulkDelete');
}

/**
 * Assert a dialect supports stored-procedure call syntax, narrowing it to
 * `SqlDialect & SupportsStoredProcedures`. See {@link requireCrud} for the capability/fallback
 * strategy.
 */
export function requireStoredProcedures(
  dialect: SqlDialect
): asserts dialect is SqlDialect & SupportsStoredProcedures {
  const supported =
    dialect.capabilities?.storedProcedures ?? typeof dialect.getSpCallSyntax === 'function';
  if (!supported) throwUnsupportedCapability(dialect, 'storedProcedures', 'getSpCallSyntax');
}

/**
 * Assert a dialect supports temporal (`FOR SYSTEM_TIME`) queries, narrowing it to
 * `SqlDialect & SupportsTemporal`. Unlike the other `require*` helpers, temporal support has no
 * distinct method to sniff — it is declared purely via `capabilities.temporal` (default
 * unsupported when `capabilities` is absent), and throws the existing `TemporalNotSupportedError`
 * (the same error `buildSelect` raises for an unsupported temporal query).
 */
export function requireTemporal(
  dialect: SqlDialect
): asserts dialect is SqlDialect & SupportsTemporal {
  if (!dialect.capabilities?.temporal) {
    throw new TemporalNotSupportedError(
      `${dialectLabel(dialect)} does not support temporal (FOR SYSTEM_TIME) queries.`
    );
  }
}
