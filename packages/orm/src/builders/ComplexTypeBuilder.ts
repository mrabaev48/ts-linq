import type { ColumnMetadata, ComplexTypePropertyMetadata } from '@ts-linq/types';

import { PropertyBuilder } from './PropertyBuilder';
import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring a complex type property.
 * Mirrors EF Core's ComplexPropertyBuilder<TComplex>.
 *
 * Complex types are value-objects: no identity, no DbSet, no ChangeTracker entry.
 * Their columns are flattened into the owner table with a prefix.
 */
export class ComplexTypeBuilder<TComplex> {
  private _columnPrefix?: string;
  private _isRequired: boolean = true;
  private readonly _columns: Map<string, ColumnMetadata> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _nestedBuilders: ComplexTypeBuilder<any>[] = [];

  constructor(private readonly _propertyName: string) {}

  /**
   * Configure a leaf property of the complex type.
   * Mirrors EF Core's ComplexPropertyBuilder.Property(selector).
   */
  property<K extends keyof TComplex>(
    selector: (e: TComplex) => TComplex[K]
  ): PropertyBuilder<TComplex[K]> {
    const propName = extractPropertyName(selector);
    return new PropertyBuilder<TComplex[K]>(propName, this._columns);
  }

  /**
   * Override the column prefix for this complex type's flattened columns.
   * Defaults to "<propertyName>_".
   */
  columnPrefix(prefix: string): this {
    this._columnPrefix = prefix;
    return this;
  }

  /**
   * Mark the complex property as required (non-nullable value-object).
   * This is the default — mirrors EF Core behavior.
   */
  isRequired(): this {
    this._isRequired = true;
    return this;
  }

  /**
   * Mark the complex property as optional (may be null at runtime).
   */
  isOptional(): this {
    this._isRequired = false;
    return this;
  }

  /**
   * Configure a nested complex type within this complex type.
   * Mirrors EF Core's ComplexPropertyBuilder.ComplexProperty(selector, configure?).
   */
  complexProperty<TNested>(
    selector: (e: TComplex) => TNested | undefined,
    configure?: (b: ComplexTypeBuilder<NonNullable<TNested>>) => void
  ): this {
    const propName = extractPropertyName(selector);
    const nested = new ComplexTypeBuilder<NonNullable<TNested>>(propName);
    if (configure) configure(nested);
    this._nestedBuilders.push(nested as unknown as ComplexTypeBuilder<unknown>);
    return this;
  }

  /** @internal — called from EntityTypeBuilder._applyToRegistry() */
  _build(): ComplexTypePropertyMetadata {
    return {
      propertyName: this._propertyName,
      columnPrefix: this._columnPrefix ?? `${this._propertyName}_`,
      isRequired: this._isRequired,
      properties: Array.from(this._columns.values()),
      nested: this._nestedBuilders.map((b) => b._build())
    };
  }
}
