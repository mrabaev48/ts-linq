import type { ColumnMetadata, ValueComparerLike, ValueConverterLike } from '@ts-linq/types';

export class PropertyBuilder<TValue> {
  private readonly _col: ColumnMetadata;

  constructor(
    propertyName: string,
    private readonly _columns: Map<string, ColumnMetadata>,
    isShadow = false
  ) {
    if (!_columns.has(propertyName)) {
      _columns.set(propertyName, {
        propertyName,
        columnName: propertyName,
        type: 'TEXT',
        ...(isShadow ? { isShadow: true } : {})
      });
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

  hasComputedColumnSql(sql: string, options?: { stored?: boolean }): this {
    this._col.isComputed = true;
    this._col.computedExpression = sql;
    this._col.computedStorage = options?.stored ? 'STORED' : 'VIRTUAL';
    return this;
  }

  hasComment(comment: string): this {
    this._col.comment = comment;
    return this;
  }

  isUnique(unique = true): this {
    this._col.unique = unique;
    return this;
  }

  isConcurrencyToken(yes = true): this {
    this._col.isConcurrencyToken = yes;
    return this;
  }

  isRowVersion(): this {
    this._col.isVersion = true;
    this._col.isConcurrencyToken = true;
    return this;
  }

  /**
   * Configures a value converter for this property.
   * Mirrors EF Core's PropertyBuilder.HasConversion().
   *
   * Overload 1: pass a pre-built ValueConverterLike instance with optional comparer.
   * Overload 2: pass explicit toProvider/fromProvider functions with optional comparer.
   */
  hasConversion<TProvider>(
    converter: ValueConverterLike<TValue, TProvider>,
    comparer?: ValueComparerLike<TValue>
  ): this;
  hasConversion<TProvider>(
    toProvider: (v: TValue) => TProvider,
    fromProvider: (v: TProvider) => TValue,
    comparer?: ValueComparerLike<TValue>
  ): this;
  hasConversion<TProvider>(
    converterOrToProvider: ValueConverterLike<TValue, TProvider> | ((v: TValue) => TProvider),
    fromProviderOrComparer?: ((v: TProvider) => TValue) | ValueComparerLike<TValue>,
    comparer?: ValueComparerLike<TValue>
  ): this {
    if (typeof converterOrToProvider === 'function') {
      const fromProvider = fromProviderOrComparer as (v: TProvider) => TValue;
      if (!fromProvider)
        throw new Error('fromProvider is required when passing toProvider as a function');
      this._col.converter = {
        toProvider: converterOrToProvider as (v: unknown) => unknown,
        fromProvider: fromProvider as (v: unknown) => unknown
      };
      if (comparer !== undefined) this._col.comparer = comparer as ValueComparerLike;
    } else {
      this._col.converter = converterOrToProvider as ValueConverterLike;
      if (fromProviderOrComparer !== undefined && typeof fromProviderOrComparer !== 'function') {
        this._col.comparer = fromProviderOrComparer as ValueComparerLike;
      }
      if (comparer !== undefined) this._col.comparer = comparer as ValueComparerLike;
    }
    return this;
  }
}
