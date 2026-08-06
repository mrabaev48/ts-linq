import type { TypeMapper } from '@ts-linq/types';

/**
 * The logical column types the *migration snapshots* speak. Anything outside this set is treated as
 * a physical type the author wrote verbatim (`VARCHAR(255)`, `DECIMAL(10,2)`, …).
 *
 * Deliberately narrower than what the dialect mappers recognize: they additionally map `BLOB`,
 * `UUID`, `JSON` and `JSONB`, but the migrations generator has always passed those through
 * unchanged, and delegating them would rewrite the DDL of every existing migration
 * (`BLOB` → `BYTEA`/`VARBINARY(MAX)`, `UUID` → `UNIQUEIDENTIFIER`/`TEXT`). Reconciling the two
 * vocabularies is tracked as follow-up work, not done implicitly here.
 */
const LOGICAL_TYPES: ReadonlySet<string> = new Set([
  'INTEGER',
  'NUMBER',
  'TEXT',
  'STRING',
  'BOOLEAN',
  'DATETIME',
  'DATE',
  'REAL',
  'FLOAT',
  'DOUBLE'
]);

/**
 * Decorates a dialect {@link TypeMapper} with the migrations passthrough policy.
 *
 * The dialect mappers map *every* unrecognized type onto a safe fallback (`TEXT` /
 * `NVARCHAR(MAX)`), which is right when the type comes from entity metadata. Migration snapshots,
 * however, may carry a physical type the author wrote by hand; collapsing those to `TEXT` would
 * silently rewrite the column. So the decorator delegates the {@link LOGICAL_TYPES} to the dialect
 * mapper — the single source of truth for that part of the logical→physical table — and passes
 * everything else through uppercased, exactly as the migrations DDL generator has always done.
 */
export class SnapshotTypeMapper implements TypeMapper {
  constructor(private readonly inner: TypeMapper) {}

  public mapType(logicalType: string, length?: number): string {
    const upper = String(logicalType || '').toUpperCase();
    if (!LOGICAL_TYPES.has(upper)) return upper;
    return this.inner.mapType(upper, length);
  }
}
