import type { MetadataRegistry } from '@ts-linq/metadata';
import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';

import { CollectionNavigationBuilder } from './CollectionNavigationBuilder';
import { IndexBuilder } from './IndexBuilder';
import { PropertyBuilder } from './PropertyBuilder';
import { ReferenceNavigationBuilder } from './ReferenceNavigationBuilder';
import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring a single entity type.
 * Mirrors EF Core's EntityTypeBuilder<T>.
 *
 * All configuration is accumulated internally and written to the registry
 * in a single batch when ModelBuilder._finalize() calls _applyToRegistry().
 * This ensures decorator metadata is fully settled before fluent overrides run.
 */
export class EntityTypeBuilder<T> {
  private _tableName?: string;
  private _schema?: string;
  private _primaryKeys?: string[];
  private readonly _columns: Map<string, ColumnMetadata> = new Map();
  private readonly _relationships: RelationshipMetadata[] = [];
  private readonly _indexes: IndexMetadata[] = [];
  private _isTemporal?: boolean;
  private _historyTableName?: string;

  constructor(private readonly _ctor: new () => T) {}

  toTable(name: string, schema?: string): this {
    this._tableName = name;
    if (schema !== undefined) this._schema = schema;
    return this;
  }

  hasKey<K extends keyof T>(...keys: K[]): this {
    this._primaryKeys = keys as string[];
    return this;
  }

  property<K extends keyof T>(selector: (e: T) => T[K]): PropertyBuilder<T[K]> {
    const propName = extractPropertyName(selector);
    return new PropertyBuilder<T[K]>(propName, this._columns);
  }

  hasOne<TRel>(
    selector: (e: T) => TRel | null | undefined,
    relClass?: new () => TRel
  ): ReferenceNavigationBuilder<T, TRel> {
    const propName = extractPropertyName(selector);
    return new ReferenceNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this._relationships
    );
  }

  hasMany<TRel>(
    selector: (e: T) => TRel[],
    relClass?: new () => TRel
  ): CollectionNavigationBuilder<T, TRel> {
    const propName = extractPropertyName(selector);
    return new CollectionNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this._relationships
    );
  }

  hasIndex<K extends keyof T>(...keys: K[]): IndexBuilder<T> {
    return new IndexBuilder<T>(this._ctor, keys as string[], this._indexes);
  }

  /**
   * Declares that this entity maps to a SQL Server system-versioned (temporal) table.
   * Allows querying historical data via `temporalAsOf`, `temporalAll`, etc.
   *
   * @example
   * mb.entity(Employee).isTemporal();
   */
  isTemporal(): this {
    this._isTemporal = true;
    return this;
  }

  /**
   * Specifies a custom name for the associated history table.
   * Defaults to `tableName + 'History'` when not set.
   *
   * @example
   * mb.entity(Employee).isTemporal().withHistoryTable('EmployeeHistoryArchive');
   */
  withHistoryTable(name: string): this {
    this._historyTableName = name;
    return this;
  }

  /** @internal */
  _applyToRegistry(registry: MetadataRegistry): void {
    registry.addEntity(this._ctor, this._tableName);

    if (this._schema !== undefined) {
      registry.mergeFluentSchema(this._ctor, this._schema);
    }

    if (this._primaryKeys !== undefined) {
      registry.setFluentPrimaryKeys(this._ctor, this._primaryKeys);
    }

    for (const column of this._columns.values()) {
      registry.mergeFluentColumn(this._ctor, column);
    }

    for (const rel of this._relationships) {
      registry.mergeFluentRelationship(this._ctor, rel);
    }

    for (const idx of this._indexes) {
      registry.mergeFluentIndex(this._ctor, idx);
    }

    if (this._isTemporal !== undefined) {
      registry.mergeFluentTemporal(this._ctor, this._isTemporal, this._historyTableName);
    }
  }
}
