import type { MetadataRegistry } from '@ts-linq/metadata';
import type {
  CheckConstraintMetadata,
  ColumnMetadata,
  IndexMetadata,
  QueryFilterMetadata,
  RelationshipMetadata,
  ShadowPropertyMetadata,
  TableFragmentMetadata
} from '@ts-linq/types';
import { InheritanceStrategy } from '@ts-linq/types';

import type { CollectionCollectionBuilder } from './CollectionCollectionBuilder';
import { CollectionNavigationBuilder } from './CollectionNavigationBuilder';
import { DiscriminatorBuilder } from './DiscriminatorBuilder';
import { IndexBuilder } from './IndexBuilder';
import { OwnedNavigationBuilder } from './OwnedNavigationBuilder';
import { PropertyBuilder } from './PropertyBuilder';
import { ReferenceNavigationBuilder } from './ReferenceNavigationBuilder';
import { TableSplitConfigBuilder } from './TableSplitConfigBuilder';
import { extractPropertyName } from './utils';

function resolveOwnedArgs<TOwned, TOwner>(
  ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void),
  configure?: (b: OwnedNavigationBuilder<TOwner, TOwned>) => void
): [new () => TOwned, ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void) | undefined] {
  // Arrow functions have undefined prototype; class constructors have an object prototype.
  if (typeof ownedCtorOrConfigure === 'function' && ownedCtorOrConfigure.prototype !== undefined) {
    return [ownedCtorOrConfigure as new () => TOwned, configure];
  }
  return [
    Object as unknown as new () => TOwned,
    ownedCtorOrConfigure as ((b: OwnedNavigationBuilder<TOwner, TOwned>) => void) | undefined
  ];
}

/**
 * Fluent builder for configuring a single entity type.
 * Mirrors EF Core's EntityTypeBuilder<T>.
 *
 * All configuration is accumulated internally and written to the registry
 * in a single batch when ModelBuilder._finalize() calls _applyToRegistry().
 * This ensures decorator metadata is fully settled before fluent overrides run.
 */
export class EntityTypeBuilder<T> {
  /** Brand used by the compile-time transformer to identify EntityTypeBuilder receivers. */
  declare readonly __tsLinqEntityTypeBuilderBrand: true;

  private _tableName?: string;
  private _schema?: string;
  private _primaryKeys?: string[];
  private readonly _columns: Map<string, ColumnMetadata> = new Map();
  private readonly _relationships: RelationshipMetadata[] = [];
  private readonly _indexes: IndexMetadata[] = [];
  private _isTemporal?: boolean;
  private _historyTableName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _ownedBuilders: OwnedNavigationBuilder<T, any>[] = [];
  private _inheritanceStrategy?: InheritanceStrategy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _discriminatorBuilder?: DiscriminatorBuilder<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _skipNavBuilders: CollectionCollectionBuilder<T, any>[] = [];
  private readonly _queryFilters: QueryFilterMetadata[] = [];
  private readonly _seedRows: Record<string, unknown>[] = [];
  private readonly _checkConstraints: CheckConstraintMetadata[] = [];
  private _entityComment?: string;
  private readonly _shadowColumns: Map<string, ColumnMetadata> = new Map();
  private readonly _tableFragments: TableFragmentMetadata[] = [];
  private _isKeyless?: boolean;
  private _viewName?: string;
  private _viewSql?: string;

  constructor(private readonly _ctor: new () => T) {}

  toTable(name: string, schema?: string): this {
    this._tableName = name;
    if (schema !== undefined) this._schema = schema;
    return this;
  }

  /**
   * Maps this entity to a database view.
   * Mirrors EF Core's `ToView(viewName)`.
   */
  toView(name: string): this {
    this._viewName = name;
    return this;
  }

  /**
   * Declares this entity as keyless — no primary key, never tracked, mutations forbidden.
   * Mirrors EF Core's `HasNoKey()`.
   */
  hasNoKey(): this {
    this._isKeyless = true;
    return this;
  }

  /**
   * Supplies optional CREATE VIEW DDL to be emitted by migrations.
   * If omitted, the view is assumed pre-existing.
   */
  hasViewSql(sql: string): this {
    this._viewSql = sql;
    return this;
  }

  /**
   * Maps additional properties of this entity to a separate physical table (entity splitting).
   * Mirrors EF Core's `SplitToTable(tableName, configure)`.
   *
   * @example
   * b.splitToTable("OrdersDetails", s => {
   *   s.property(o => o.notes);
   *   s.property(o => o.internalRef);
   * });
   */
  splitToTable(
    tableName: string,
    configure: (b: TableSplitConfigBuilder<T>) => void,
    schema?: string
  ): this {
    const configBuilder = new TableSplitConfigBuilder<T>();
    configure(configBuilder);
    this._tableFragments.push({
      tableName,
      ...(schema !== undefined ? { schema } : {}),
      properties: configBuilder._build()
    });
    return this;
  }

  hasKey<K extends keyof T>(...keys: K[]): this {
    this._primaryKeys = keys as string[];
    return this;
  }

  property<TValue>(name: string): PropertyBuilder<TValue>;
  property<K extends keyof T>(selector: (e: T) => T[K]): PropertyBuilder<T[K]>;
  property<TValue, K extends keyof T>(
    selectorOrName: ((e: T) => T[K]) | string
  ): PropertyBuilder<TValue> | PropertyBuilder<T[K]> {
    if (typeof selectorOrName === 'string') {
      return new PropertyBuilder<TValue>(selectorOrName, this._shadowColumns, true);
    }
    const propName = extractPropertyName(selectorOrName);
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
      this._relationships,
      this._skipNavBuilders
    );
  }

  hasIndex<K extends keyof T>(...keys: K[]): IndexBuilder<T> {
    return new IndexBuilder<T>(this._ctor, keys as string[], this._indexes);
  }

  ownsOne<TOwned>(
    selector: (e: T) => TOwned | undefined,
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    const propName = extractPropertyName(selector);
    const [resolvedCtor, resolvedConfigure] = resolveOwnedArgs(ownedCtorOrConfigure, configure);
    const builder = new OwnedNavigationBuilder<T, TOwned>(
      this._ctor,
      resolvedCtor as new () => TOwned,
      propName,
      false
    );
    resolvedConfigure?.(builder);
    this._ownedBuilders.push(builder);
    return builder;
  }

  ownsMany<TOwned>(
    selector: (e: T) => TOwned[],
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    const propName = extractPropertyName(selector);
    const [resolvedCtor, resolvedConfigure] = resolveOwnedArgs(ownedCtorOrConfigure, configure);
    const builder = new OwnedNavigationBuilder<T, TOwned>(
      this._ctor,
      resolvedCtor as new () => TOwned,
      propName,
      true
    );
    resolvedConfigure?.(builder);
    this._ownedBuilders.push(builder);
    return builder;
  }

  /**
   * Configures a discriminator column for TPH inheritance.
   * Automatically sets strategy to TPH; chain `.hasValue()` to register subtypes.
   *
   * @example
   * mb.entity(Payment)
   *   .hasDiscriminator<string>('kind')
   *   .hasValue(CardPayment, 'card')
   *   .hasValue(BankPayment, 'bank');
   */
  hasDiscriminator<TKey>(name: string, type = 'TEXT'): DiscriminatorBuilder<TKey> {
    this._inheritanceStrategy = InheritanceStrategy.Tph;
    const builder = new DiscriminatorBuilder<TKey>(name, type);
    this._discriminatorBuilder = builder;
    return builder;
  }

  /** Explicitly select Table-per-Hierarchy storage strategy. */
  useTphMappingStrategy(): this {
    this._inheritanceStrategy = InheritanceStrategy.Tph;
    return this;
  }

  /** Select Table-per-Type storage strategy (base table + per-subtype joined tables). */
  useTptMappingStrategy(): this {
    this._inheritanceStrategy = InheritanceStrategy.Tpt;
    return this;
  }

  /** Select Table-per-Concrete-type storage strategy (one table per leaf, UNION ALL). */
  useTpcMappingStrategy(): this {
    this._inheritanceStrategy = InheritanceStrategy.Tpc;
    return this;
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

  /**
   * Adds a global query filter applied to every SELECT for this entity.
   * Use the unnamed overload for a single filter, or supply a name (EF9) to compose multiple.
   *
   * **Requires the ts-linq compile-time transformer** — the predicate lambda is rewritten
   * by the TypeScript transformer plugin into `hasQueryFilterCompiled(...)`.
   */
  hasQueryFilter(predicate: (e: T) => boolean): this;
  hasQueryFilter(name: string, predicate: (e: T) => boolean): this;
  hasQueryFilter(
    _nameOrPredicate: string | ((e: T) => boolean),
    _predicate?: (e: T) => boolean
  ): this {
    throw new Error(
      "ts-linq(hasQueryFilter): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
    );
  }

  /** @internal — called by the compile-time transformer in place of hasQueryFilter. */
  hasQueryFilterCompiled(
    nameOrCompiled: string | { ast: unknown; parameters: readonly unknown[] },
    compiled?: { ast: unknown; parameters: readonly unknown[] }
  ): this {
    let name: string;
    let filter: { ast: unknown; parameters: readonly unknown[] };
    if (typeof nameOrCompiled === 'string') {
      name = nameOrCompiled;
      filter = compiled!;
    } else {
      name = '_default';
      filter = nameOrCompiled;
    }
    const idx = this._queryFilters.findIndex((f) => f.name === name);
    const entry: QueryFilterMetadata = { name, ast: filter.ast, parameters: filter.parameters };
    if (idx >= 0) {
      this._queryFilters[idx] = entry;
    } else {
      this._queryFilters.push(entry);
    }
    return this;
  }

  /**
   * Adds a CHECK constraint to this entity's table.
   * Mirrors EF Core's `HasCheckConstraint(name, sql)`.
   */
  hasCheckConstraint(name: string, sql: string): this {
    this._checkConstraints.push({ name, sql });
    return this;
  }

  /**
   * Sets a documentation comment for this entity's table.
   * Mirrors EF Core's `HasComment(comment)`.
   */
  hasComment(comment: string): this {
    this._entityComment = comment;
    return this;
  }

  /**
   * Declares seed rows for this entity. Rows must have stable primary key values.
   * Mirrors EF Core's `HasData(...)`.
   */
  hasData(...rows: T[]): this {
    this._seedRows.push(...(rows as Record<string, unknown>[]));
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

    for (const ob of this._ownedBuilders) {
      registry.addOwnedEntity(this._ctor, ob._buildMetadata());
    }

    if (this._inheritanceStrategy !== undefined) {
      const disc = this._discriminatorBuilder?._buildMetadata();
      const subtypes = disc?.entries.map((e) => e.ctor) ?? [];
      registry.setHierarchyMetadata(this._ctor, {
        strategy: this._inheritanceStrategy,
        rootEntity: this._ctor,
        discriminator: disc,
        subtypes
      });
      for (const sub of subtypes) {
        registry.setHierarchyRoot(sub, this._ctor);
      }
    }

    // Process skip navigation (many-to-many) builders after primary keys are set
    const leftPk = this._primaryKeys?.[0] ?? 'id';
    for (const snb of this._skipNavBuilders) {
      snb._applyToRegistry(registry, leftPk, 'id');
    }

    if (this._seedRows.length > 0) {
      registry.setSeedData(this._ctor, [...this._seedRows]);
    }

    if (this._checkConstraints.length > 0) {
      registry.setCheckConstraints(this._ctor, [...this._checkConstraints]);
    }

    if (this._entityComment !== undefined) {
      registry.setEntityComment(this._ctor, this._entityComment);
    }

    for (const col of this._shadowColumns.values()) {
      const shadowProp: ShadowPropertyMetadata = {
        propertyName: col.propertyName,
        columnName: col.columnName,
        type: col.type,
        nullable: col.nullable,
        defaultValue: col.defaultValue,
        defaultExpression: col.defaultExpression,
        comment: col.comment,
        length: col.length,
        precision: col.precision,
        scale: col.scale
      };
      registry.addShadowProperty(this._ctor, shadowProp);
    }

    if (this._tableFragments.length > 0) {
      registry.mergeFluentTableFragments(this._ctor, this._tableFragments);
    }

    if (this._isKeyless !== undefined) {
      registry.setFluentKeyless(this._ctor, this._isKeyless);
    }

    if (this._viewName !== undefined) {
      registry.setFluentViewName(this._ctor, this._viewName);
    }

    if (this._viewSql !== undefined) {
      registry.setFluentViewSql(this._ctor, this._viewSql);
    }
  }

  /** @internal — returns per-context query filters (not stored in global MetadataRegistry). */
  _getQueryFilters(): ReadonlyArray<import('@ts-linq/types').QueryFilterMetadata> {
    return this._queryFilters;
  }
}
