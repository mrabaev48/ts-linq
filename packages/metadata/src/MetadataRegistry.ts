import type {
  AlternateKeyMetadata,
  CheckConstraintMetadata,
  ColumnMetadata,
  ComplexTypePropertyMetadata,
  EntityCtor,
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
import { ValidationError } from '@ts-linq/types';

import { EntityMetadataBuilder } from './EntityMetadata';
import { PendingMetadataCollector } from './PendingMetadataCollector';
import { reflectGetOwnMetadata } from './reflectUtils';

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
 */
export class MetadataRegistry implements MetadataSource, MetadataSink {
  private entities: Map<Function, EntityMetadata> = new Map();
  private builders: Map<Function, EntityMetadataBuilder> = new Map();
  private readonly spMappings = new Map<Function, EntityStoredProcedureMapping>();

  // ─── Normalization ────────────────────────────────────────────────────────

  private normalizeTarget<T extends Function>(target: T): T {
    if (!target || typeof target !== 'function') return target;
    const maybe = reflectGetOwnMetadata('orm:original', target);
    const original = typeof maybe === 'function' ? (maybe as T) : undefined;
    return original ?? target;
  }

  // ─── Builder helpers ──────────────────────────────────────────────────────

  private getOrCreateBuilder(target: Function): EntityMetadataBuilder {
    const key = this.normalizeTarget(target);
    if (!this.builders.has(key)) {
      this.builders.set(key, new EntityMetadataBuilder(key));
    }
    return this.builders.get(key)!;
  }

  private finalizeEntity(target: Function): void {
    const key = this.normalizeTarget(target);
    if (this.builders.has(key)) {
      const metadata = this.builders.get(key)!.build();
      this.entities.set(key, metadata);
      this.builders.delete(key);
    }
  }

  private collectPendingMetadata(target: Function): void {
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
        this.addColumnMetadata(target, columnMeta);
      }
      for (const propertyName of pendingPrimaryKeys) {
        this.addPrimaryKeyMetadata(target, propertyName);
      }
      for (const indexMeta of pendingIndexes) {
        this.addIndexMetadata(target, indexMeta);
      }
      for (const [, relationMeta] of pendingRelationships.entries()) {
        this.addRelationshipMetadata(target, relationMeta);
      }
      PendingMetadataCollector.clear(target);
    }
  }

  // ─── Private mutation helpers ─────────────────────────────────────────────

  private registerEntity(target: Function, tableName?: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      if (tableName) finalized.tableName = tableName;
      return;
    }
    const builder = this.getOrCreateBuilder(target);
    if (tableName) builder.setTableName(tableName);
  }

  private addColumnMetadata(target: Function, column: ColumnMetadata): void {
    if (column.defaultExpression !== undefined && column.defaultValue !== undefined) {
      throw new ValidationError(
        `Column ${column.columnName} cannot have both defaultExpression and defaultValue`
      );
    }
    if (column.isComputed) {
      if (column.defaultValue !== undefined || column.defaultExpression !== undefined) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot have defaultValue/defaultExpression`
        );
      }
      if (column.isGenerated) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot be marked as isGenerated`
        );
      }
      if (column.isVersion) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot be a version column`
        );
      }
      (column as { isReadOnly?: boolean }).isReadOnly = true;
    }
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      if (!finalized.columns.some((c) => c.propertyName === column.propertyName)) {
        finalized.columns = [...finalized.columns, column];
      }
      return;
    }
    this.getOrCreateBuilder(target).addColumn(column);
  }

  private addPrimaryKeyMetadata(target: Function, propertyName: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      if (!finalized.primaryKeys?.includes(propertyName)) {
        finalized.primaryKeys = [...(finalized.primaryKeys || []), propertyName];
      }
      return;
    }
    this.getOrCreateBuilder(target).addPrimaryKey(propertyName);
  }

  private addRelationshipMetadata(target: Function, relationship: RelationshipMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.relationships = [...finalized.relationships, relationship];
      return;
    }
    this.getOrCreateBuilder(target).addRelationship(relationship);
  }

  private addIndexMetadata(target: Function, index: IndexMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      if (finalized.indexes.some((i) => i.name === index.name)) {
        throw new ValidationError(
          `Duplicate index name '${index.name}' on entity '${finalized.tableName}'`
        );
      }
      const existingCols = new Set(
        finalized.columns.map((c) => [c.columnName, c.propertyName]).flat()
      );
      const missing = index.columns.filter((c) => !existingCols.has(c));
      if (missing.length > 0) {
        throw new ValidationError(
          `Index '${index.name}' on entity '${finalized.tableName}' references unknown columns: ${missing.join(', ')}`
        );
      }
      finalized.indexes = [...finalized.indexes, index];
      return;
    }
    const builder = this.getOrCreateBuilder(target);
    const snapshot = builder.build();
    if ((snapshot.indexes || []).some((i) => i.name === index.name)) {
      throw new ValidationError(
        `Duplicate index name '${index.name}' on entity '${snapshot.tableName}'`
      );
    }
    const existingCols = new Set(
      (snapshot.columns || []).map((c) => [c.columnName, c.propertyName]).flat()
    );
    const missing = index.columns.filter((c) => !existingCols.has(c));
    if (missing.length > 0) {
      throw new ValidationError(
        `Index '${index.name}' on entity '${snapshot.tableName}' references unknown columns: ${missing.join(', ')}`
      );
    }
    builder.addIndex(index);
  }

  private addValidationRuleMetadata(target: Function, rule: ValidationRule): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.validations = [...(finalized.validations || []), rule];
      return;
    }
    this.getOrCreateBuilder(target).addValidationRule(rule);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public getEntity(target: Function): EntityMetadata | undefined {
    if (!target || typeof target !== 'function') return undefined;
    try {
      const maybe = reflectGetOwnMetadata('orm:original', target);
      const original = typeof maybe === 'function' ? maybe : target;
      const key = this.normalizeTarget(original);
      if (this.builders.has(key)) {
        this.collectPendingMetadata(key);
        this.finalizeEntity(key);
      }
      const meta = this.entities.get(key);
      if (!meta) return undefined;
      // task-5: registry keys remain `Function`; an entity target is a constructor.
      return original !== target ? { ...meta, target: target as EntityCtor } : meta;
    } catch {
      const key = this.normalizeTarget(target);
      if (this.builders.has(key)) {
        this.collectPendingMetadata(key);
        this.finalizeEntity(key);
      }
      return this.entities.get(key);
    }
  }

  public getEntities(): EntityMetadata[] {
    for (const target of this.builders.keys()) {
      this.finalizeEntity(target);
    }
    return Array.from(this.entities.values());
  }

  public getValidationRules(target: Function): ValidationRule[] {
    return this.getEntity(target)?.validations ?? [];
  }

  public addEntity(target: Function, tableName?: string): void {
    this.registerEntity(target, tableName);
  }

  public addColumn(target: Function, column: ColumnMetadata): void {
    this.addColumnMetadata(target, column);
  }

  public addPrimaryKey(target: Function, propertyName: string): void {
    this.addPrimaryKeyMetadata(target, propertyName);
  }

  public addRelationship(target: Function, relationship: RelationshipMetadata): void {
    this.addRelationshipMetadata(target, relationship);
  }

  public addIndex(target: Function, index: IndexMetadata): void {
    this.addIndexMetadata(target, index);
  }

  public addValidationRule(target: Function, rule: ValidationRule): void {
    this.addValidationRuleMetadata(target, rule);
  }

  // ─── Fluent override API ──────────────────────────────────────────────────

  /** Merge a fluent column definition (fluent wins on conflict). */
  public mergeFluentColumn(target: Function, column: ColumnMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      const idx = finalized.columns.findIndex((c) => c.propertyName === column.propertyName);
      if (idx >= 0) {
        finalized.columns[idx] = { ...finalized.columns[idx], ...column };
      } else {
        finalized.columns = [...finalized.columns, column];
      }
      return;
    }
    this.getOrCreateBuilder(target).mergeColumn(column);
  }

  /** Replace all primary keys with fluent-specified ones (fluent wins). */
  public setFluentPrimaryKeys(target: Function, keys: string[]): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.primaryKeys = [...keys];
      return;
    }
    this.getOrCreateBuilder(target).setPrimaryKeys(keys);
  }

  /** Merge a fluent relationship definition (fluent wins on conflict). */
  public mergeFluentRelationship(target: Function, relationship: RelationshipMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      const idx = finalized.relationships.findIndex(
        (r) => r.propertyName === relationship.propertyName
      );
      if (idx >= 0) {
        finalized.relationships[idx] = { ...finalized.relationships[idx], ...relationship };
      } else {
        finalized.relationships = [...finalized.relationships, relationship];
      }
      return;
    }
    this.getOrCreateBuilder(target).mergeRelationship(relationship);
  }

  /** Merge a fluent index definition (fluent wins on conflict). */
  public mergeFluentIndex(target: Function, index: IndexMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      const idx = finalized.indexes.findIndex((i) => i.name === index.name);
      if (idx >= 0) {
        finalized.indexes[idx] = { ...finalized.indexes[idx], ...index };
      } else {
        finalized.indexes = [...finalized.indexes, index];
      }
      return;
    }
    this.getOrCreateBuilder(target).mergeIndex(index);
  }

  /** Merge an alternate key definition (fluent wins on conflict). */
  public mergeFluentAlternateKey(target: Function, ak: AlternateKeyMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.alternateKeys = finalized.alternateKeys ?? [];
      const idx = finalized.alternateKeys.findIndex((k) => k.name === ak.name);
      if (idx >= 0) {
        finalized.alternateKeys[idx] = ak;
      } else {
        finalized.alternateKeys.push(ak);
      }
      return;
    }
    this.getOrCreateBuilder(target).addAlternateKey(ak);
  }

  /** Set the schema for an entity (fluent override). */
  public mergeFluentSchema(target: Function, schema: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.schema = schema;
      return;
    }
    this.getOrCreateBuilder(target).setSchema(schema);
  }

  /** Mark the entity as a SQL Server system-versioned (temporal) table (fluent override). */
  public mergeFluentTemporal(
    target: Function,
    isTemporal: boolean,
    historyTableName?: string
  ): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.isTemporal = isTemporal;
      if (historyTableName !== undefined) finalized.historyTableName = historyTableName;
      return;
    }
    const builder = this.getOrCreateBuilder(target);
    builder.setTemporal(isTemporal);
    if (historyTableName !== undefined) builder.setHistoryTableName(historyTableName);
  }

  /** Register an owned entity relationship for the given owner entity. */
  public addComplexProperty(owner: Function, complex: ComplexTypePropertyMetadata): void {
    const key = this.normalizeTarget(owner);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.complexProperties = [...(finalized.complexProperties ?? []), complex];
      return;
    }
    this.getOrCreateBuilder(owner).addComplexProperty(complex);
  }

  public addOwnedEntity(owner: Function, owned: OwnedEntityMetadata): void {
    const key = this.normalizeTarget(owner);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.ownedEntities = [...(finalized.ownedEntities || []), owned];
      return;
    }
    this.getOrCreateBuilder(owner).addOwnedEntity(owned);
  }

  /** Get all owned entity relationships for the given owner entity. */
  public getOwnedEntities(owner: Function): OwnedEntityMetadata[] {
    return this.getEntity(owner)?.ownedEntities ?? [];
  }

  /** Set hierarchy metadata on the root entity. */
  public setHierarchyMetadata(target: Function, h: HierarchyMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.hierarchy = h;
      return;
    }
    this.getOrCreateBuilder(target).setHierarchy(h);
  }

  /** Mark a subtype entity as belonging to a hierarchy rooted at `root`. */
  public setHierarchyRoot(subtype: Function, root: Function): void {
    const key = this.normalizeTarget(subtype);
    const finalized = this.entities.get(key);
    if (finalized) {
      // task-5: registry keys remain `Function`; the hierarchy root is a constructor.
      finalized.hierarchyRoot = root as EntityCtor;
      return;
    }
    this.getOrCreateBuilder(subtype).setHierarchyRoot(root);
  }

  /** Register or replace a skip navigation on an entity. */
  public mergeFluentSkipNavigation(target: Function, nav: SkipNavigationMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.skipNavigations = finalized.skipNavigations ?? [];
      const idx = finalized.skipNavigations.findIndex((sn) => sn.propertyName === nav.propertyName);
      if (idx >= 0) {
        finalized.skipNavigations[idx] = nav;
      } else {
        finalized.skipNavigations.push(nav);
      }
      return;
    }
    this.getOrCreateBuilder(target).addSkipNavigation(nav);
  }

  public mergeFluentQueryFilter(target: Function, filter: QueryFilterMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.queryFilters = finalized.queryFilters ?? [];
      const idx = finalized.queryFilters.findIndex((f) => f.name === filter.name);
      if (idx >= 0) {
        finalized.queryFilters[idx] = filter;
      } else {
        finalized.queryFilters.push(filter);
      }
      return;
    }
    this.getOrCreateBuilder(target).addQueryFilter(filter);
  }

  /** Set (replace) seed data rows for an entity (P0-13). */
  public setSeedData(target: Function, rows: Record<string, unknown>[]): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.seedData = rows;
      return;
    }
    this.getOrCreateBuilder(target).setSeedData(rows);
  }

  /** Set CHECK constraints for an entity (P0-14). */
  public setCheckConstraints(target: Function, constraints: CheckConstraintMetadata[]): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.checkConstraints = constraints;
      return;
    }
    this.getOrCreateBuilder(target).setCheckConstraints(constraints);
  }

  /** Set table-level comment for an entity (P0-14). */
  public setEntityComment(target: Function, comment: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.comment = comment;
      return;
    }
    this.getOrCreateBuilder(target).setEntityComment(comment);
  }

  /** Set (replace) table fragment metadata for entity splitting (P1-25). */
  public mergeFluentTableFragments(target: Function, fragments: TableFragmentMetadata[]): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.tableFragments = [...fragments];
      return;
    }
    this.getOrCreateBuilder(target).setTableFragments(fragments);
  }

  /** Add or replace a shadow property for an entity (P1-16). */
  public addShadowProperty(target: Function, prop: ShadowPropertyMetadata): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      if (!finalized.shadowProperties) {
        finalized.shadowProperties = new Map();
      }
      finalized.shadowProperties.set(prop.propertyName, prop);
      return;
    }
    this.getOrCreateBuilder(target).addShadowProperty(prop);
  }

  /** Mark an entity as keyless — no PK, never tracked (P1-26). */
  public setFluentKeyless(target: Function, value: boolean): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.isKeyless = value;
      return;
    }
    this.getOrCreateBuilder(target).setIsKeyless(value);
  }

  /** Set the database view name for an entity (P1-26). */
  public setFluentViewName(target: Function, name: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.viewName = name;
      return;
    }
    this.getOrCreateBuilder(target).setViewName(name);
  }

  /** Set optional CREATE VIEW DDL for migration emission (P1-26). */
  public setFluentViewSql(target: Function, sql: string): void {
    const key = this.normalizeTarget(target);
    const finalized = this.entities.get(key);
    if (finalized) {
      finalized.viewSql = sql;
      return;
    }
    this.getOrCreateBuilder(target).setViewSql(sql);
  }

  /** Set (replace) stored procedure CUD mapping for an entity (P2-33). */
  public setStoredProcedureMapping(target: Function, mapping: EntityStoredProcedureMapping): void {
    const key = this.normalizeTarget(target);
    this.spMappings.set(key, mapping);
  }

  /** Get stored procedure CUD mapping for an entity (P2-33). */
  public getStoredProcedureMapping(target: Function): EntityStoredProcedureMapping | undefined {
    const key = this.normalizeTarget(target);
    return this.spMappings.get(key);
  }

  /** Clear all stored metadata and pending builders. */
  public clear(): void {
    this.entities.clear();
    this.builders.clear();
    this.spMappings.clear();
  }
}
