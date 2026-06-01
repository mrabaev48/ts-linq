import type {
  SpCallResult,
  SpCallSyntax,
  SpParameterMapping,
  StoredProcedureConfig
} from '@ts-linq/types';

export type { SpCallResult, SpCallSyntax };

function resolveValue(
  param: SpParameterMapping,
  entity: Record<string, unknown>,
  originalValues: Record<string, unknown> | undefined
): unknown {
  if (param.isOriginalValue) {
    return originalValues?.[param.propertyName] ?? null;
  }
  return entity[param.propertyName] ?? null;
}

/** Emitter for CALL syntax (PostgreSQL and MySQL). */
export class CallSyntaxEmitter implements SpCallSyntax {
  constructor(private readonly dialect: 'postgres' | 'mysql') {}

  emitCall(
    config: StoredProcedureConfig,
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined
  ): SpCallResult {
    const parameters: import('@ts-linq/types').SqlParameter[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const param of config.parameters) {
      if (param.direction === 'output' && this.dialect === 'mysql') {
        // MySQL OUT params use session variables, not inline bind values
        const varName = `@${param.parameterName ?? param.propertyName}`;
        placeholders.push(varName);
      } else if (param.direction === 'output' && this.dialect === 'postgres') {
        // PG OUT params: pass NULL placeholder so positional args stay aligned
        placeholders.push(`$${idx}`);
        parameters.push(null);
        idx++;
      } else {
        const value = resolveValue(param, entity, originalValues);
        placeholders.push(this.dialect === 'postgres' ? `$${idx}` : '?');
        parameters.push(value as import('@ts-linq/types').SqlParameter);
        idx++;
      }
    }

    if (config.rowsAffectedMode === 'parameter' && config.rowsAffectedParameterName !== undefined) {
      if (this.dialect === 'mysql') {
        placeholders.push(`@${config.rowsAffectedParameterName}`);
      } else {
        placeholders.push(this.dialect === 'postgres' ? `$${idx}` : '?');
        parameters.push(null);
      }
    }

    const sql = `CALL ${config.procedureName}(${placeholders.join(', ')})`;
    return { sql, parameters };
  }

  extractRowsAffected(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[],
    _returnValue?: unknown
  ): number {
    if (config.rowsAffectedMode === 'resultColumn') {
      const row = resultRows[0];
      if (row && 'rows_affected' in row) return Number(row['rows_affected']) || 0;
      return 0;
    }
    if (config.rowsAffectedMode === 'parameter' && config.rowsAffectedParameterName) {
      const row = resultRows[0];
      if (row) return Number(row[config.rowsAffectedParameterName]) || 0;
    }
    return 1;
  }

  extractOutputValues(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[]
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const row = resultRows[0];
    if (!row) return out;

    for (const param of config.parameters) {
      if (param.direction === 'output' || param.direction === 'inputOutput') {
        const colName = param.parameterName ?? param.propertyName;
        if (colName in row) out[param.propertyName] = row[colName];
      }
    }
    return out;
  }

  getFollowUpSelectParams(config: StoredProcedureConfig): string[] {
    if (this.dialect !== 'mysql') return [];
    return config.parameters
      .filter((p) => p.direction === 'output' || p.direction === 'inputOutput')
      .map((p) => p.parameterName ?? p.propertyName);
  }
}

/** Emitter for EXEC syntax (Microsoft SQL Server). */
export class ExecSyntaxEmitter implements SpCallSyntax {
  emitCall(
    config: StoredProcedureConfig,
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined
  ): SpCallResult {
    const parameters: import('@ts-linq/types').SqlParameter[] = [];
    const parts: string[] = [];
    let idx = 0;

    for (const param of config.parameters) {
      const dbParamName = param.parameterName ?? param.propertyName;
      const bindVar = `@v${idx}`;
      const value = resolveValue(param, entity, originalValues);
      parameters.push(value as import('@ts-linq/types').SqlParameter);
      const isOutput = param.direction === 'output' || param.direction === 'inputOutput';
      parts.push(`@${dbParamName} = ${bindVar}${isOutput ? ' OUTPUT' : ''}`);
      idx++;
    }

    if (config.rowsAffectedMode === 'parameter' && config.rowsAffectedParameterName !== undefined) {
      const bindVar = `@v${idx}`;
      parameters.push(null);
      parts.push(`@${config.rowsAffectedParameterName} = ${bindVar} OUTPUT`);
    }

    let sql = `EXEC ${config.procedureName}${parts.length > 0 ? ' ' + parts.join(', ') : ''}`;

    if (config.rowsAffectedMode === 'returnValue') {
      sql += '; SELECT @@ROWCOUNT AS rows_affected';
    }

    return { sql, parameters };
  }

  extractRowsAffected(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[],
    _returnValue?: unknown
  ): number {
    if (config.rowsAffectedMode === 'returnValue' || config.rowsAffectedMode === 'resultColumn') {
      const row = resultRows[0];
      if (row && 'rows_affected' in row) return Number(row['rows_affected']) || 0;
      return 0;
    }
    if (config.rowsAffectedMode === 'parameter' && config.rowsAffectedParameterName) {
      const row = resultRows[0];
      if (row) return Number(row[config.rowsAffectedParameterName]) || 0;
    }
    return 1;
  }

  extractOutputValues(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[]
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const row = resultRows[0];
    if (!row) return out;

    for (const param of config.parameters) {
      if (param.direction === 'output' || param.direction === 'inputOutput') {
        const colName = param.parameterName ?? param.propertyName;
        if (colName in row) out[param.propertyName] = row[colName];
      }
    }
    return out;
  }
}
