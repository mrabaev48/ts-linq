// Маппинг хранимых процедур (P2-33)

import type { SqlParameter } from './sql';

// ─── Stored Procedure Mapping types (P2-33) ──────────────────────────────────

export type SpParameterDirection = 'input' | 'output' | 'inputOutput';
export type SpRowsAffectedMode = 'none' | 'parameter' | 'resultColumn' | 'returnValue';

export interface SpParameterMapping {
  propertyName: string;
  /** DB parameter name override; defaults to propertyName when absent. */
  parameterName?: string;
  direction: SpParameterDirection;
  /** When true, bind the snapshot (original) value instead of the current value. */
  isOriginalValue?: boolean;
}

export interface StoredProcedureConfig {
  procedureName: string;
  parameters: SpParameterMapping[];
  rowsAffectedMode: SpRowsAffectedMode;
  /** Only relevant when rowsAffectedMode === 'parameter'. */
  rowsAffectedParameterName?: string;
}

export interface EntityStoredProcedureMapping {
  insert?: StoredProcedureConfig;
  update?: StoredProcedureConfig;
  delete?: StoredProcedureConfig;
}

export interface SpCallResult {
  sql: string;
  parameters: SqlParameter[];
}

/** Dialect-neutral contract for emitting a stored procedure call statement. */
export interface SpCallSyntax {
  emitCall(
    config: StoredProcedureConfig,
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined
  ): SpCallResult;

  extractRowsAffected(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[],
    returnValue?: unknown
  ): number;

  extractOutputValues(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[]
  ): Record<string, unknown>;

  /** MySQL only: param names that need a follow-up SELECT @name query for OUT values. */
  getFollowUpSelectParams?(config: StoredProcedureConfig): string[];
}
