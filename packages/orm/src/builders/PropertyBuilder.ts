import type { ColumnMetadata } from '@ts-linq/types';

/**
 * Fluent builder for configuring a single entity property / column.
 * Mirrors EF Core's PropertyBuilder<T>.
 *
 * All mutations are written back to the shared columns Map owned by
 * EntityTypeBuilder so that _applyToRegistry() sees the final state.
 */
export class PropertyBuilder<TValue> {
  private readonly _col: ColumnMetadata;

  /**
   * @param propertyName  Name of the TypeScript property.
   * @param columns       Shared Map from EntityTypeBuilder; this builder writes into it.
   */
  constructor(propertyName: string, columns: Map<string, ColumnMetadata>) {
    // Clone to avoid mutating any pre-existing entry from decorator metadata
    this._col = {
      ...(columns.get(propertyName) ?? { propertyName, columnName: propertyName, type: 'TEXT' })
    };
    columns.set(propertyName, this._col);
  }

  /** Override the database column name. */
  hasColumnName(name: string): this {
    this._col.columnName = name;
    return this;
  }

  /** Set the SQL type (e.g. 'INTEGER', 'VARCHAR(255)'). */
  hasColumnType(type: string): this {
    this._col.type = type;
    return this;
  }

  /** Mark the column as NOT NULL (required = true) or nullable (required = false). */
  isRequired(required = true): this {
    this._col.nullable = !required;
    return this;
  }

  /** Explicitly set nullable. */
  isNullable(nullable = true): this {
    this._col.nullable = nullable;
    return this;
  }

  /** Set maximum character length; maps to VARCHAR/NVARCHAR length. */
  hasMaxLength(length: number): this {
    this._col.length = length;
    return this;
  }

  /** Set numeric precision. */
  hasPrecision(precision: number, scale?: number): this {
    this._col.precision = precision;
    if (scale !== undefined) this._col.scale = scale;
    return this;
  }

  /** Set a constant default value emitted in DDL (DEFAULT <value>). */
  hasDefaultValue(value: unknown): this {
    this._col.defaultValue = value;
    return this;
  }

  /** Set a SQL expression default (DEFAULT <expr>). */
  hasDefaultValueSql(expression: string): this {
    this._col.defaultExpression = expression;
    return this;
  }

  /** Mark the column as UNIQUE. */
  isUnique(unique = true): this {
    this._col.unique = unique;
    return this;
  }
}
