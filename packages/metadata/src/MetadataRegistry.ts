import type {
  AlternateKeyMetadata,
  CheckConstraintMetadata,
  ColumnMetadata,
  ComplexTypePropertyMetadata,
  EntityCtor,
  EntityCtorRef,
  EntityMetadata,
  HierarchyMetadata,
  IndexMetadata,
  MetadataSink,
  MetadataSource,
  OwnedEntityMetadata,
  QueryFilterMetadata,
  RelationshipMetadata,
  ShadowPropertyMetadata,
  SkipNavigationMetadata,
  TableFragmentMetadata,
  ValidationRule
} from '@ts-linq/types';
import type { EntityStoredProcedureMapping } from '@ts-linq/types';
import { MetadataError, OrmError } from '@ts-linq/types';

import { PendingMetadataCollector } from './PendingMetadataCollector';
import { reflectGetOwnMetadata } from './reflectUtils';
import { AdvancedMappingStore } from './registry/AdvancedMappingStore';
import { ColumnMetadataStore } from './registry/ColumnMetadataStore';
import { ConstraintStore } from './registry/ConstraintStore';
import { EntityMetadataState } from './registry/EntityMetadataState';
import { IndexStore } from './registry/IndexStore';
import { RelationshipStore } from './registry/RelationshipStore';
import { StoredProcedureStore } from './registry/StoredProcedureStore';
import { TableConfigStore } from './registry/TableConfigStore';

/**
 * Isolated, injectable metadata store for entity classes.
 *
 * Unlike the process-wide `MetadataStorage` singleton, each `MetadataRegistry`
 * instance is fully independent — making it safe to use in parallel tests,
 * multi-tenant setups, or any scenario that requires isolated entity schemas.
 *
 * Pass an instance via `DbContextOptions.registry`; decorators still write to
 * the process-wide default via `MetadataStorage`, which is always available as
 * a fallback when no registry is supplied.
 *
 * Internally this class is a thin **facade**: a shared {@link EntityMetadataState}
 * kernel owns the builder/finalized two-stage store and the single
 * finalized-vs-builder `mutate` seam, while cohesive facet stores
 * ({@link ColumnMetadataStore}, {@link RelationshipStore}, {@link IndexStore},
 * {@link ConstraintStore}, {@link TableConfigStore}, {@link AdvancedMappingStore},
 * {@link StoredProcedureStore}) own each metadata concern. The public API below
 * is unchanged; every method delegates to the relevant collaborator.
 */
export class MetadataRegistry implements MetadataSource, MetadataSink {
  private readonly state = new EntityMetadataState();
  private readonly columns = new ColumnMetadataStore(this.state);
  private readonly relationships = new RelationshipStore(this.state);
  private readonly indexes = new IndexStore(this.state);
  private readonly constraints = new ConstraintStore(this.state);
  private readonly tableConfig = new TableConfigStore(this.state);
  private readonly advanced = new AdvancedMappingStore(this.state);
  private readonly storedProcedures = new StoredProcedureStore(this.state);

  // ─── Pending decorator flush ──────────────────────────────────────────────

  private collectPendingMetadata(target: EntityCtor): void {
    const pendingColumns = PendingMetadataCollector.getColumns(target);
    const pendingPrimaryKeys = PendingMetadataCollector.getPrimaryKeys(target);
    const pendingIndexes = PendingMetadataCollector.getIndexes(target);
    const pendingRelationships = PendingMetadataCollector.getRelationships(target);

    if (
      pendingColumns.size > 0 ||
      pendingPrimaryKeys.size > 0 ||
      pendingIndexes.length > 0 ||
      pendingRelationships.size > 0
    ) {
      for (const [, columnMeta] of pendingColumns.entries()) {
        this.columns.addColumn(target, columnMeta);
      }
      for (const propertyName of pendingPrimaryKeys) {
        this.columns.addPrimaryKey(target, propertyName);
      }
      for (const indexMeta of pendingIndexes) {
        this.indexes.addIndex(target, indexMeta);
      }
      for (const [, relationMeta] of pendingRelationships.entries()) {
        this.relationships.addRelationship(target, relationMeta);
      }
      PendingMetadataCollector.clear(target);
    }
  }

  // ─── Read API (MetadataSource) ────────────────────────────────────────────

  public getEntity(target: EntityCtorRef): EntityMetadata | undefined {
    if (!target || typeof target !== 'function') return undefined;

    // Reads accept any constructor reference (EntityCtorRef); an entity target is
    // a constructor, so narrow to the EntityCtor type the internal stores key on.
    const ctor = target as EntityCtor;
    const { original, key } = this.resolveTarget(ctor);
    if (this.state.hasBuilder(key)) {
      this.collectPendingMetadata(key);
      this.state.finalizeEntity(key);
    }
    const meta = this.state.getFinalized(key);
    if (!meta) return undefined;
    // Re-base the descriptor's `target` to the queried constructor when the
    // caller passed a wrapper that resolved to a different original.
    return original !== ctor ? { ...meta, target: ctor } : meta;
  }

  /**
   * Resolve a possibly-wrapped decorator target back to its declared constructor
   * via the single reflect-metadata capability probe ({@link reflectGetOwnMetadata}).
   *
   * Never throws for control flow: when reflect-metadata is absent the probe
   * returns `undefined` (Null Object) and the original target is used as-is.
   * `protected` so tests can inject a throwing resolver to exercise the
   * typed-error path.
   */
  protected resolveOriginal(target: EntityCtor): EntityCtor {
    const maybe = reflectGetOwnMetadata('orm:original', target);
    // The reflect probe returns `unknown`; a resolved `orm:original` is the
    // declared entity constructor. Narrow the callable to `EntityCtor`.
    return typeof maybe === 'function' ? (maybe as EntityCtor) : target;
  }

  /**
   * Resolve the wrapper→original target and its normalized store key.
   *
   * Translation-only seam (never a control-flow fallback): the reflect probe
   * does not throw for absence, but an *unexpected* failure during resolution
   * must surface typed rather than vanish into a silent fallback. Already-typed
   * {@link OrmError}s propagate unchanged; anything else is wrapped in a
   * {@link MetadataError} preserving the original `cause`.
   */
  private resolveTarget(target: EntityCtor): { original: EntityCtor; key: EntityCtor } {
    try {
      const original = this.resolveOriginal(target);
      const key = this.state.normalizeTarget(original);
      return { original, key };
    } catch (cause) {
      if (cause instanceof OrmError) throw cause;
      throw new MetadataError(
        `Failed to resolve entity metadata for "${target.name || '<anonymous>'}".`,
        { cause, details: { target: target.name } }
      );
    }
  }

  public getEntities(): EntityMetadata[] {
    this.state.finalizeAllBuilders();
    return this.state.getAllEntities();
  }

  public getValidationRules(target: EntityCtorRef): ValidationRule[] {
    return this.getEntity(target)?.validations ?? [];
  }

  /** Get all owned entity relationships for the given owner entity. */
  public getOwnedEntities(owner: EntityCtorRef): OwnedEntityMetadata[] {
    return this.getEntity(owner)?.ownedEntities ?? [];
  }

  /** Get stored procedure CUD mapping for an entity (P2-33). */
  public getStoredProcedureMapping(
    target: EntityCtorRef
  ): EntityStoredProcedureMapping | undefined {
    return this.storedProcedures.getStoredProcedureMapping(target as EntityCtor);
  }

  // ─── Write API (MetadataSink) ─────────────────────────────────────────────

  public addEntity(target: EntityCtor, tableName?: string): void {
    this.tableConfig.registerEntity(target, tableName);
  }

  public addColumn(target: EntityCtor, column: ColumnMetadata): void {
    this.columns.addColumn(target, column);
  }

  public addPrimaryKey(target: EntityCtor, propertyName: string): void {
    this.columns.addPrimaryKey(target, propertyName);
  }

  public addRelationship(target: EntityCtor, relationship: RelationshipMetadata): void {
    this.relationships.addRelationship(target, relationship);
  }

  public addIndex(target: EntityCtor, index: IndexMetadata): void {
    this.indexes.addIndex(target, index);
  }

  public addValidationRule(target: EntityCtor, rule: ValidationRule): void {
    this.constraints.addValidationRule(target, rule);
  }

  // ─── Fluent override API ──────────────────────────────────────────────────

  /** Merge a fluent column definition (fluent wins on conflict). */
  public mergeFluentColumn(target: EntityCtor, column: ColumnMetadata): void {
    this.columns.mergeFluentColumn(target, column);
  }

  /** Replace all primary keys with fluent-specified ones (fluent wins). */
  public setFluentPrimaryKeys(target: EntityCtor, keys: string[]): void {
    this.columns.setFluentPrimaryKeys(target, keys);
  }

  /** Merge a fluent relationship definition (fluent wins on conflict). */
  public mergeFluentRelationship(target: EntityCtor, relationship: RelationshipMetadata): void {
    this.relationships.mergeFluentRelationship(target, relationship);
  }

  /** Merge a fluent index definition (fluent wins on conflict). */
  public mergeFluentIndex(target: EntityCtor, index: IndexMetadata): void {
    this.indexes.mergeFluentIndex(target, index);
  }

  /** Merge an alternate key definition (fluent wins on conflict). */
  public mergeFluentAlternateKey(target: EntityCtor, ak: AlternateKeyMetadata): void {
    this.indexes.mergeFluentAlternateKey(target, ak);
  }

  /** Set the schema for an entity (fluent override). */
  public mergeFluentSchema(target: EntityCtor, schema: string): void {
    this.tableConfig.mergeFluentSchema(target, schema);
  }

  /** Mark the entity as a SQL Server system-versioned (temporal) table (fluent override). */
  public mergeFluentTemporal(
    target: EntityCtor,
    isTemporal: boolean,
    historyTableName?: string
  ): void {
    this.tableConfig.mergeFluentTemporal(target, isTemporal, historyTableName);
  }

  /** Register a complex (value-object) property for the given owner entity. */
  public addComplexProperty(owner: EntityCtor, complex: ComplexTypePropertyMetadata): void {
    this.advanced.addComplexProperty(owner, complex);
  }

  public addOwnedEntity(owner: EntityCtor, owned: OwnedEntityMetadata): void {
    this.advanced.addOwnedEntity(owner, owned);
  }

  /** Set hierarchy metadata on the root entity. */
  public setHierarchyMetadata(target: EntityCtor, h: HierarchyMetadata): void {
    this.advanced.setHierarchyMetadata(target, h);
  }

  /** Mark a subtype entity as belonging to a hierarchy rooted at `root`. */
  public setHierarchyRoot(subtype: EntityCtor, root: EntityCtor): void {
    this.advanced.setHierarchyRoot(subtype, root);
  }

  /** Register or replace a skip navigation on an entity. */
  public mergeFluentSkipNavigation(target: EntityCtor, nav: SkipNavigationMetadata): void {
    this.advanced.mergeFluentSkipNavigation(target, nav);
  }

  public mergeFluentQueryFilter(target: EntityCtor, filter: QueryFilterMetadata): void {
    this.advanced.mergeFluentQueryFilter(target, filter);
  }

  /** Set (replace) seed data rows for an entity (P0-13). */
  public setSeedData(target: EntityCtor, rows: Record<string, unknown>[]): void {
    this.tableConfig.setSeedData(target, rows);
  }

  /** Set CHECK constraints for an entity (P0-14). */
  public setCheckConstraints(target: EntityCtor, constraints: CheckConstraintMetadata[]): void {
    this.constraints.setCheckConstraints(target, constraints);
  }

  /** Set table-level comment for an entity (P0-14). */
  public setEntityComment(target: EntityCtor, comment: string): void {
    this.tableConfig.setEntityComment(target, comment);
  }

  /** Set (replace) table fragment metadata for entity splitting (P1-25). */
  public mergeFluentTableFragments(target: EntityCtor, fragments: TableFragmentMetadata[]): void {
    this.tableConfig.mergeFluentTableFragments(target, fragments);
  }

  /** Add or replace a shadow property for an entity (P1-16). */
  public addShadowProperty(target: EntityCtor, prop: ShadowPropertyMetadata): void {
    this.columns.addShadowProperty(target, prop);
  }

  /** Mark an entity as keyless — no PK, never tracked (P1-26). */
  public setFluentKeyless(target: EntityCtor, value: boolean): void {
    this.tableConfig.setFluentKeyless(target, value);
  }

  /** Set the database view name for an entity (P1-26). */
  public setFluentViewName(target: EntityCtor, name: string): void {
    this.tableConfig.setFluentViewName(target, name);
  }

  /** Set optional CREATE VIEW DDL for migration emission (P1-26). */
  public setFluentViewSql(target: EntityCtor, sql: string): void {
    this.tableConfig.setFluentViewSql(target, sql);
  }

  /** Set (replace) stored procedure CUD mapping for an entity (P2-33). */
  public setStoredProcedureMapping(
    target: EntityCtor,
    mapping: EntityStoredProcedureMapping
  ): void {
    this.storedProcedures.setStoredProcedureMapping(target, mapping);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Clear all stored metadata and pending builders. */
  public clear(): void {
    this.state.clearState();
    this.storedProcedures.clear();
  }
}
