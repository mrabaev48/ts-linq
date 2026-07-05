import type { SqlParameter, TemporalClause, TemporalMode } from '@ts-linq/types';

/**
 * Appends a `FOR SYSTEM_TIME` clause to an MSSQL SELECT query for system-versioned tables.
 *
 * Date parameters are pushed into the provided `params` array using `?` placeholders,
 * which are then renumbered to `@p1..@pN` by the shared `numberPlaceholders` helper.
 *
 * @param temporal - Temporal clause describing the operator and optional date bounds.
 * @param params   - Mutable parameter array; date values are appended here.
 * @returns The `FOR SYSTEM_TIME …` SQL fragment (starts with a space).
 *
 * @example
 * buildTemporalClause({ mode: 'AsOf', from: new Date('2023-01-01') }, params)
 * // → ' FOR SYSTEM_TIME AS OF ?'   (? → @p1 after renumbering)
 */
export function buildTemporalClause(temporal: TemporalClause, params: SqlParameter[]): string {
  switch (temporal.mode) {
    case 'AsOf': {
      assertDate(temporal.from, 'AsOf', 'from');
      params.push(temporal.from!);
      return ' FOR SYSTEM_TIME AS OF ?';
    }
    case 'All': {
      return ' FOR SYSTEM_TIME ALL';
    }
    case 'Between': {
      assertDate(temporal.from, 'Between', 'from');
      assertDate(temporal.to, 'Between', 'to');
      params.push(temporal.from!);
      params.push(temporal.to!);
      return ' FOR SYSTEM_TIME BETWEEN ? AND ?';
    }
    case 'FromTo': {
      assertDate(temporal.from, 'FromTo', 'from');
      assertDate(temporal.to, 'FromTo', 'to');
      params.push(temporal.from!);
      params.push(temporal.to!);
      return ' FOR SYSTEM_TIME FROM ? TO ?';
    }
    case 'ContainedIn': {
      assertDate(temporal.from, 'ContainedIn', 'from');
      assertDate(temporal.to, 'ContainedIn', 'to');
      params.push(temporal.from!);
      params.push(temporal.to!);
      return ' FOR SYSTEM_TIME CONTAINED IN (?, ?)';
    }
    default: {
      const exhaustiveCheck: never = temporal.mode;
      throw new Error(`Unsupported temporal mode: ${String(exhaustiveCheck)}`);
    }
  }
}

function assertDate(value: Date | undefined, mode: TemporalMode, param: string): void {
  if (!(value instanceof Date)) {
    throw new TypeError(
      `temporalClause: mode '${mode}' requires a Date value for '${param}', got ${String(value)}.`
    );
  }
}
