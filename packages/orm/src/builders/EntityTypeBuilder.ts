import type { MetadataRegistry, PropertyAccessMode } from '@ts-linq/metadata';
import type { StoredProcedureBuilder } from '@ts-linq/metadata';
import type { QueryFilterMetadata } from '@ts-linq/types';
import { OrmConfigurationError } from '@ts-linq/types';

import { ColumnAspect } from './aspects/ColumnAspect';
import type { AspectApplyContext, EntityConfigAspect } from './aspects/EntityConfigAspect';
import { IndexAndConstraintAspect } from './aspects/IndexAndConstraintAspect';
import { InheritanceAspect } from './aspects/InheritanceAspect';
import { KeyAndTableAspect } from './aspects/KeyAndTableAspect';
import { MiscMetadataAspect } from './aspects/MiscMetadataAspect';
import { OwnedAndComplexAspect } from './aspects/OwnedAndComplexAspect';
import { QueryFilterAspect } from './aspects/QueryFilterAspect';
import { RelationshipAspect } from './aspects/RelationshipAspect';
import { SkipNavigationAspect } from './aspects/SkipNavigationAspect';
import { StoredProcedureAspect } from './aspects/StoredProcedureAspect';
import { TableSplittingAspect } from './aspects/TableSplittingAspect';
import { CollectionNavigationBuilder } from './CollectionNavigationBuilder';
import type { ComplexTypeBuilder } from './ComplexTypeBuilder';
import type { DiscriminatorBuilder } from './DiscriminatorBuilder';
import type { IndexBuilder } from './IndexBuilder';
import type { OwnedNavigationBuilder } from './OwnedNavigationBuilder';
import { PropertyBuilder } from './PropertyBuilder';
import type { ReferenceNavigationBuilder } from './ReferenceNavigationBuilder';
import type { TableSplitConfigBuilder } from './TableSplitConfigBuilder';
import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring a single entity type. Mirrors EF Core's `EntityTypeBuilder<T>`.
 *
 * A thin **facade**: each fluent method delegates to a cohesive, per-concern
 * {@link EntityConfigAspect} (the aspects carry the behaviour docs). Configuration is accumulated
 * in the aspects and written to the registry in a single batch when `ModelBuilder._finalize()`
 * calls `_applyToRegistry()`, which iterates the aspects in an explicit, documented order (see
 * `_applyOrder`) — ensuring decorator metadata is fully settled before fluent overrides run.
 */
export class EntityTypeBuilder<T extends object> {
  /** Brand used by the compile-time transformer to identify EntityTypeBuilder receivers. */
  declare readonly __tsLinqEntityTypeBuilderBrand: true;

  private readonly _keyAndTable = new KeyAndTableAspect<T>();
  private readonly _column = new ColumnAspect<T>();
  private readonly _relationship: RelationshipAspect<T>;
  private readonly _indexAndConstraint: IndexAndConstraintAspect<T>;
  private readonly _inheritance = new InheritanceAspect<T>();
  private readonly _ownedAndComplex: OwnedAndComplexAspect<T>;
  private readonly _skipNav = new SkipNavigationAspect<T>();
  private readonly _tableSplitting = new TableSplittingAspect<T>();
  private readonly _queryFilter = new QueryFilterAspect<T>();
  private readonly _storedProcedure = new StoredProcedureAspect<T>();
  private readonly _misc = new MiscMetadataAspect<T>();

  /**
   * Aspects in their apply order. The only hard ordering constraints are:
   *   1. `KeyAndTableAspect` runs first — its `addEntity` creates the registry record every other
   *      aspect merges into, and it publishes `ctx.primaryKeys`.
   *   2. `SkipNavigationAspect` runs after `KeyAndTableAspect` — it reads `ctx.primaryKeys` to
   *      derive the m2m left foreign key (the former implicit "skip-nav after PKs" sequencing).
   * All remaining aspects write independent, ctor-keyed registry entries; their order is for
   * readability only.
   */
  private readonly _applyOrder: readonly EntityConfigAspect<T>[];

  constructor(private readonly _ctor: new () => T) {
    this._relationship = new RelationshipAspect<T>(_ctor);
    this._indexAndConstraint = new IndexAndConstraintAspect<T>(_ctor);
    this._ownedAndComplex = new OwnedAndComplexAspect<T>(_ctor);
    this._applyOrder = [
      this._keyAndTable, // 1. addEntity + schema + PKs (publishes ctx.primaryKeys) — must be first
      this._column, // 2. columns + shadow properties
      this._relationship, // 3. relationships
      this._indexAndConstraint, // 4. indexes + alternate keys + check constraints
      this._inheritance, // 5. TPH/TPT/TPC hierarchy + discriminator
      this._ownedAndComplex, // 6. owned entities + complex properties
      this._skipNav, // 7. skip navigations (m2m) — PK-dependent, reads ctx.primaryKeys
      this._tableSplitting, // 8. table fragments (entity splitting)
      this._queryFilter, // 9. query filters (no-op on registry; per-context)
      this._storedProcedure, // 10. stored-procedure mapping
      this._misc // 11. temporal / seed / comment / keyless / view
    ];
  }

  toTable(name: string, schema?: string): this {
    this._keyAndTable.toTable(name, schema);
    return this;
  }

  toView(name: string): this {
    this._misc.toView(name);
    return this;
  }

  hasNoKey(): this {
    this._misc.hasNoKey();
    return this;
  }

  /** Sets the default access mode for all properties; overridable per-property. */
  usePropertyAccessMode(mode: PropertyAccessMode): this {
    this._column.usePropertyAccessMode(mode);
    return this;
  }

  /** Optional CREATE VIEW DDL for migrations; if omitted, the view is assumed pre-existing. */
  hasViewSql(sql: string): this {
    this._misc.hasViewSql(sql);
    return this;
  }

  /** Maps additional properties to a separate table (entity splitting; `SplitToTable(...)`). */
  splitToTable(
    tableName: string,
    configure: (b: TableSplitConfigBuilder<T>) => void,
    schema?: string
  ): this {
    this._tableSplitting.splitToTable(tableName, configure, schema);
    return this;
  }

  hasKey<K extends keyof T>(...keys: K[]): this {
    this._keyAndTable.hasKey(keys as string[]);
    return this;
  }

  /** Configures a mapped property (selector) or a shadow property (string name). */
  property<TValue>(name: string): PropertyBuilder<TValue>;
  property<K extends keyof T>(selector: (e: T) => T[K]): PropertyBuilder<T[K]>;
  property<TValue, K extends keyof T>(
    selectorOrName: ((e: T) => T[K]) | string
  ): PropertyBuilder<TValue> | PropertyBuilder<T[K]> {
    if (typeof selectorOrName === 'string') {
      return new PropertyBuilder<TValue>(selectorOrName, this._column.shadowColumns, true);
    }
    const propName = extractPropertyName(selectorOrName);
    return new PropertyBuilder<T[K]>(propName, this._column.columns);
  }

  hasOne<TRel extends object>(
    selector: (e: T) => TRel | null | undefined,
    relClass?: new () => TRel
  ): ReferenceNavigationBuilder<T, TRel> {
    return this._relationship.hasOne(selector, relClass);
  }

  hasMany<TRel extends object>(
    selector: (e: T) => TRel[],
    relClass?: new () => TRel
  ): CollectionNavigationBuilder<T, TRel> {
    // Bridges two aspects: the relationship accumulator and the skip-navigation (m2m) accumulator.
    const propName = extractPropertyName(selector);
    return new CollectionNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this._relationship.relationships,
      this._skipNav.skipNavBuilders
    );
  }

  hasIndex(selector: (e: T) => unknown): IndexBuilder<T>;
  hasIndex<K extends keyof T>(...keys: K[]): IndexBuilder<T>;
  hasIndex<K extends keyof T>(
    selectorOrKey: ((e: T) => unknown) | K,
    ...restKeys: K[]
  ): IndexBuilder<T> {
    return this._indexAndConstraint.hasIndex(selectorOrKey, restKeys);
  }

  hasAlternateKey(selector: (e: T) => unknown): this {
    this._indexAndConstraint.hasAlternateKey(selector);
    return this;
  }

  ownsOne<TOwned extends object>(
    selector: (e: T) => TOwned | undefined,
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    return this._ownedAndComplex.ownsOne(selector, ownedCtorOrConfigure, configure);
  }

  ownsMany<TOwned extends object>(
    selector: (e: T) => TOwned[],
    ownedCtorOrConfigure?: (new () => TOwned) | ((b: OwnedNavigationBuilder<T, TOwned>) => void),
    configure?: (b: OwnedNavigationBuilder<T, TOwned>) => void
  ): OwnedNavigationBuilder<T, TOwned> {
    return this._ownedAndComplex.ownsMany(selector, ownedCtorOrConfigure, configure);
  }

  /** Configures a complex-type (identity-less value object) property; columns flatten into owner. */
  complexProperty<TComplex>(
    selector: (e: T) => TComplex | undefined,
    configure?: (b: ComplexTypeBuilder<NonNullable<TComplex>>) => void
  ): this {
    this._ownedAndComplex.complexProperty(selector, configure);
    return this;
  }

  /** Configures a TPH discriminator column (implies TPH); chain `.hasValue()` for subtypes. */
  hasDiscriminator<TKey>(name: string, type = 'TEXT'): DiscriminatorBuilder<TKey> {
    return this._inheritance.hasDiscriminator<TKey>(name, type);
  }

  useTphMappingStrategy(): this {
    this._inheritance.useTph();
    return this;
  }

  useTptMappingStrategy(): this {
    this._inheritance.useTpt();
    return this;
  }

  useTpcMappingStrategy(): this {
    this._inheritance.useTpc();
    return this;
  }

  isTemporal(): this {
    this._misc.isTemporal();
    return this;
  }

  withHistoryTable(name: string): this {
    this._misc.withHistoryTable(name);
    return this;
  }

  /**
   * Adds a global query filter applied to every SELECT for this entity.
   *
   * **Requires the ts-linq compile-time transformer** — the predicate lambda is rewritten by the
   * TypeScript transformer plugin into `hasQueryFilterCompiled(...)`.
   */
  hasQueryFilter(predicate: (e: T) => boolean): this;
  hasQueryFilter(name: string, predicate: (e: T) => boolean): this;
  hasQueryFilter(
    _nameOrPredicate: string | ((e: T) => boolean),
    _predicate?: (e: T) => boolean
  ): this {
    throw OrmConfigurationError.transformerRequired();
  }

  /** @internal — called by the compile-time transformer in place of hasQueryFilter. */
  hasQueryFilterCompiled(
    nameOrCompiled: string | { ast: unknown; parameters: readonly unknown[] },
    compiled?: { ast: unknown; parameters: readonly unknown[] }
  ): this {
    this._queryFilter.hasQueryFilterCompiled(nameOrCompiled, compiled);
    return this;
  }

  hasCheckConstraint(name: string, sql: string): this {
    this._indexAndConstraint.hasCheckConstraint(name, sql);
    return this;
  }

  hasComment(comment: string): this {
    this._misc.hasComment(comment);
    return this;
  }

  hasData(...rows: T[]): this {
    this._misc.hasData(rows as Record<string, unknown>[]);
    return this;
  }

  insertUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): this {
    this._storedProcedure.insertUsingStoredProcedure(name, configure);
    return this;
  }

  updateUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): this {
    this._storedProcedure.updateUsingStoredProcedure(name, configure);
    return this;
  }

  deleteUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): this {
    this._storedProcedure.deleteUsingStoredProcedure(name, configure);
    return this;
  }

  /** @internal — applies all accumulated aspects to the registry in the declared order. */
  _applyToRegistry(registry: MetadataRegistry): void {
    const ctx: AspectApplyContext = {};
    for (const aspect of this._applyOrder) {
      aspect.applyTo(registry, this._ctor, ctx);
    }
  }

  /** @internal — returns per-context query filters (not stored in global MetadataRegistry). */
  _getQueryFilters(): ReadonlyArray<QueryFilterMetadata> {
    return this._queryFilter.getQueryFilters();
  }
}
