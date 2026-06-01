import type {
  SpParameterDirection,
  SpParameterMapping,
  StoredProcedureConfig
} from '@ts-linq/types';

export type {
  EntityStoredProcedureMapping,
  SpCallResult,
  SpCallSyntax,
  SpParameterDirection,
  SpParameterMapping,
  SpRowsAffectedMode,
  StoredProcedureConfig
} from '@ts-linq/types';

function extractSpPropertyName<T, V>(selector: (e: T) => V): string {
  const str = selector.toString();
  const arrow = str.match(/=>\s*\w+\.(\w+)/);
  if (arrow) return arrow[1];
  const bracket = str.match(/=>\s*\w+\[['"](\w+)['"]\]/);
  if (bracket) return bracket[1];
  const ret = str.match(/return\s+\w+\.(\w+)/);
  if (ret) return ret[1];
  throw new Error(`Cannot extract property name from selector: ${str}`);
}

/** Fluent builder for a single stored procedure parameter. */
export class SpParamBuilder {
  private _direction: SpParameterDirection = 'input';
  private _parameterName?: string;

  isOutput(): this {
    this._direction = 'output';
    return this;
  }

  isInputOutput(): this {
    this._direction = 'inputOutput';
    return this;
  }

  hasName(name: string): this {
    this._parameterName = name;
    return this;
  }

  /** @internal */
  _build(propertyName: string): SpParameterMapping {
    return {
      propertyName,
      direction: this._direction,
      ...(this._parameterName !== undefined ? { parameterName: this._parameterName } : {})
    };
  }
}

/** Fluent builder for a single CUD stored procedure mapping. */
export class StoredProcedureBuilder<T> {
  private readonly _parameters: SpParameterMapping[] = [];
  private _rowsAffectedMode: import('@ts-linq/types').SpRowsAffectedMode = 'none';
  private _rowsAffectedParameterName?: string;

  hasParameter<K extends keyof T>(
    selector: (t: T) => T[K],
    cfg?: (p: SpParamBuilder) => SpParamBuilder
  ): this {
    const propertyName = extractSpPropertyName(selector);
    const builder = new SpParamBuilder();
    const configured = cfg ? cfg(builder) : builder;
    this._parameters.push(configured._build(propertyName));
    return this;
  }

  hasOriginalValueParameter<K extends keyof T>(selector: (t: T) => T[K]): this {
    const propertyName = extractSpPropertyName(selector);
    this._parameters.push({ propertyName, direction: 'input', isOriginalValue: true });
    return this;
  }

  hasRowsAffectedParameter(paramName?: string): this {
    this._rowsAffectedMode = 'parameter';
    this._rowsAffectedParameterName = paramName;
    return this;
  }

  hasRowsAffectedResultColumn(): this {
    this._rowsAffectedMode = 'resultColumn';
    return this;
  }

  hasRowsAffectedReturnValue(): this {
    this._rowsAffectedMode = 'returnValue';
    return this;
  }

  /** @internal */
  _build(procedureName: string): StoredProcedureConfig {
    return {
      procedureName,
      parameters: [...this._parameters],
      rowsAffectedMode: this._rowsAffectedMode,
      ...(this._rowsAffectedParameterName !== undefined
        ? { rowsAffectedParameterName: this._rowsAffectedParameterName }
        : {})
    };
  }
}
