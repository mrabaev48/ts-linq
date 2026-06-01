import {
  createPropertyAccessor,
  PropertyAccessMode,
  type PropertyAccessor
} from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  ValueComparerLike,
  ValueConverterLike,
  ValueGeneratorClass
} from '@ts-linq/types';
import { ValueGeneratedPolicy } from '@ts-linq/types';

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

  valueGeneratedOnAdd(): this {
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.OnAdd;
    return this;
  }

  valueGeneratedOnUpdate(): this {
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.OnUpdate;
    return this;
  }

  valueGeneratedOnAddOrUpdate(): this {
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.OnAddOrUpdate;
    return this;
  }

  valueGeneratedNever(): this {
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.Never;
    return this;
  }

  hasValueGenerator<T>(generatorClass: ValueGeneratorClass<T>): this {
    this._col.valueGeneratorClass = generatorClass as ValueGeneratorClass;
    return this;
  }

  hasSentinel(value: TValue): this {
    this._col.sentinel = value;
    return this;
  }

  /**
   * Configures the property to use the Hi-Lo key generation pattern.
   * The ORM reserves a block of IDs in a single round-trip and assigns them locally.
   * Mirrors EF Core's `PropertyBuilder.UseHiLo()`.
   *
   * @example
   *   b.property(c => c.id).useHiLo('CustomerHiLo', { schema: 'shared', blockSize: 20 });
   */
  useHiLo(sequenceName = '__hilo', options?: { schema?: string; blockSize?: number }): this {
    this._col.sequenceName = sequenceName;
    this._col.sequenceSchema = options?.schema;
    this._col.hiLoBlockSize = options?.blockSize ?? 10;
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.OnAdd;
    return this;
  }

  /**
   * Configures the property to draw its value from a database sequence via DEFAULT expression.
   * Mirrors EF Core's `PropertyBuilder.UseSequence()`.
   *
   * @example
   *   b.property(p => p.id).useSequence('ProductSeq');
   */
  useSequence(sequenceName: string, options?: { schema?: string }): this {
    this._col.sequenceName = sequenceName;
    this._col.sequenceSchema = options?.schema;
    this._col.valueGeneratedPolicy = ValueGeneratedPolicy.OnAdd;
    return this;
  }

  /**
   * Specifies the backing field name used to store this property's value.
   * By convention `_propertyName` is assumed when not provided.
   * Mirrors EF Core's `PropertyBuilder.HasField(fieldName)`.
   */
  hasField(fieldName: string): this {
    this._col.fieldName = fieldName;
    this._rebuildAccessor();
    return this;
  }

  /**
   * Sets the property access mode controlling how the ORM reads/writes this property.
   * Mirrors EF Core's `PropertyBuilder.UsePropertyAccessMode(mode)`.
   */
  usePropertyAccessMode(mode: PropertyAccessMode): this {
    this._col.accessMode = mode;
    this._rebuildAccessor();
    return this;
  }

  private _rebuildAccessor(): void {
    const explicitMode = this._col.accessMode as PropertyAccessMode | undefined;
    const isDefaultPropertyMode =
      (!explicitMode || explicitMode === PropertyAccessMode.Property) && !this._col.fieldName;
    if (isDefaultPropertyMode) {
      // No accessor needed: default property-mode access is handled by the hot-path fallback.
      this._col.accessor = undefined;
      return;
    }
    // When only a fieldName is provided (no explicit mode), default to FieldDuringConstruction:
    // hydration bypasses the setter (DDD-friendly), post-construction reads go through the property.
    const mode = explicitMode ?? PropertyAccessMode.FieldDuringConstruction;
    this._col.accessor = createPropertyAccessor(
      this._col.propertyName,
      this._col.fieldName,
      mode
    ) as PropertyAccessor;
  }
}
