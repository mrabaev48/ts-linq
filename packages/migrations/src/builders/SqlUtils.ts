import type { Dialect } from '../Dialect';
import { QuoterFactory } from './quoting/QuoterFactory';

/**
 * Back-compat facade over the audited per-dialect {@link SqlQuoter}. Escapes embedded
 * quote characters and wraps the identifier. Kept for existing callers; new code may use
 * `QuoterFactory.for(dialect)` directly.
 */
export function q(dialect: Dialect, id: string): string {
  return QuoterFactory.for(dialect).id(id);
}

export function mapType(dialect: Dialect, t: string): string {
  const up = String(t || '').toUpperCase();
  const group = groupType(up);
  if (!group) return up;
  const perDialect: Record<Dialect, Record<string, string>> = {
    postgresql: {
      int: 'INTEGER',
      text: 'TEXT',
      bool: 'BOOLEAN',
      date: 'TIMESTAMPTZ',
      float: 'DOUBLE PRECISION'
    },
    mysql: {
      int: 'INT',
      text: 'TEXT',
      bool: 'TINYINT(1)',
      date: 'DATETIME',
      float: 'DOUBLE'
    },
    mssql: {
      int: 'INT',
      text: 'NVARCHAR(MAX)',
      bool: 'BIT',
      date: 'DATETIME2',
      float: 'FLOAT'
    }
  };
  return perDialect[dialect][group];
}

export function groupType(up: string): 'int' | 'text' | 'bool' | 'date' | 'float' | null {
  if (up === 'INTEGER' || up === 'NUMBER') return 'int';
  if (up === 'TEXT' || up === 'STRING') return 'text';
  if (up === 'BOOLEAN') return 'bool';
  if (up === 'DATETIME' || up === 'DATE') return 'date';
  if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'float';
  return null;
}

/**
 * Back-compat facade over the audited per-dialect {@link SqlQuoter} literal encoder.
 * Folded into the single `literal()` path so identifier and value encoding share one
 * auditable authority. Kept for existing callers.
 */
export function formatValue(dialect: Dialect, v: unknown): string {
  return QuoterFactory.for(dialect).literal(v);
}

export function norm(t: string): string {
  return String(t || '')
    .trim()
    .toUpperCase();
}
