import type { ColumnMetadata } from '@ts-linq/types';

export class PropertyBuilder<TValue> {
  private readonly _col: ColumnMetadata;

  constructor(
    propertyName: string,
    private readonly _columns: Map<string, ColumnMetadata>
  ) {
    if (!_columns.has(propertyName)) {
      _columns.set(propertyName, { propertyName, columnName: propertyName, type: 'TEXT' });
    }
    this._col = _columns.get(propertyName)!;
  }

  hasColumnName(name: string): this {
    this._col.columnName = name;
    return this;
  }

  hasColumnType(type: string): this {
    this._col.type = type;
    return this;
  }

  isRequired(required = true): this {
    this._col.nullable = !required;
    return this;
  }

  isNullable(nullable = true): this {
    this._col.nullable = nullable;
    return this;
  }

  hasMaxLength(length: number): this {
    this._col.length = length;
    return this;
  }

  hasPrecision(precision: number, scale?: number): this {
    this._col.precision = precision;
    if (scale !== undefined) this._col.scale = scale;
    return this;
  }

  hasDefaultValue(value: TValue): this {
    this._col.defaultValue = value;
    return this;
  }

  hasDefaultValueSql(sql: string): this {
    this._col.defaultExpression = sql;
    return this;
  }

  isUnique(unique = true): this {
    this._col.unique = unique;
    return this;
  }
}
