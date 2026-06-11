import type { SetterSpec, SqlParameter } from '@ts-linq/types';

import { extractKey } from './extractKey';

/**
 * Fluent builder for collecting SET assignments in executeUpdate().
 * Mirrors EF Core's ISetPropertyCalls<T>.
 */
export interface ISetPropertyCalls<T> {
  /**
   * Adds a SET assignment to the bulk UPDATE.
   *
   * @param propertySelector - Lambda selecting the property to update, e.g. `e => e.name`.
   * @param valueOrSelector  - The new value (literal) **or** a lambda selecting another column,
   *   e.g. `e => e.displayName` (generates `name = display_name`).
   *
   * To use a computed SQL expression like `count + 1`, pre-compute the value in JavaScript
   * and pass it as a literal (transformer-based value expressions are deferred to a later task).
   */
  setProperty<TProp>(
    propertySelector: (e: T) => TProp,
    valueOrSelector: TProp | ((e: T) => TProp)
  ): ISetPropertyCalls<T>;
}

/** Internal representation of a single SET entry before column-name resolution. */
export interface SetterEntry {
  /** TypeScript property name on the entity class. */
  propertyName: string;
  value: { kind: 'literal'; params: SqlParameter[] } | { kind: 'column'; refPropertyName: string };
}

function coerceToSqlParameter(value: unknown): SqlParameter {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value as SqlParameter;
  }
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

export class SetPropertyCalls<T> implements ISetPropertyCalls<T> {
  private readonly _setters: SetterEntry[] = [];

  public setProperty<TProp>(
    propertySelector: (e: T) => TProp,
    valueOrSelector: TProp | ((e: T) => TProp)
  ): ISetPropertyCalls<T> {
    const propertyName = extractKey<T>(propertySelector);

    if (typeof valueOrSelector === 'function') {
      const refPropertyName = extractKey<T>(valueOrSelector as (e: T) => unknown);
      this._setters.push({ propertyName, value: { kind: 'column', refPropertyName } });
    } else {
      this._setters.push({
        propertyName,
        value: { kind: 'literal', params: [coerceToSqlParameter(valueOrSelector)] }
      });
    }

    return this;
  }

  /** Returns the collected setter entries for dialect SQL generation. */
  public getSetters(): ReadonlyArray<SetterEntry> {
    return this._setters;
  }

  /**
   * Resolves TypeScript property names to SQL column names using entity metadata columns,
   * and returns the dialect-ready SetterSpec[].
   */
  public toSetterSpecs(
    columns: ReadonlyArray<{ propertyName: string; columnName: string }>
  ): SetterSpec[] {
    return this._setters.map((entry) => {
      const col = columns.find((c) => c.propertyName === entry.propertyName);
      if (!col) {
        throw new Error(
          `executeUpdate: no column mapping found for property '${entry.propertyName}'. ` +
            `Ensure the property is decorated with @Column().`
        );
      }

      const entryValue = entry.value;
      if (entryValue.kind === 'literal') {
        return {
          columnName: col.columnName,
          value: { kind: 'literal' as const, params: entryValue.params }
        };
      }

      const refCol = columns.find((c) => c.propertyName === entryValue.refPropertyName);
      if (!refCol) {
        throw new Error(
          `executeUpdate: no column mapping found for reference property '${entryValue.refPropertyName}'.`
        );
      }
      return {
        columnName: col.columnName,
        value: { kind: 'column' as const, refColumnName: refCol.columnName }
      };
    });
  }
}
