import type { EntityMetadata, ColumnMetadata, RelationshipMetadata, IndexMetadata, ValidationRule } from '@ts-linq/types';
import { MetadataRegistry } from './MetadataRegistry';

/**
 * Process-wide façade that keeps the legacy static API intact.
 *
 * All mutation and query methods delegate to an internal `MetadataRegistry`
 * instance (`_defaultRegistry`).  Decorators continue to call these static
 * methods unchanged.
 *
 * For test isolation or multi-tenant scenarios, create a fresh `MetadataRegistry`
 * and pass it to `DbContextOptions.registry` instead of relying on this singleton.
 * You can also swap the default registry via `MetadataStorage.setDefaultRegistry()`
 * for advanced test setups that need to override the process-wide store.
 */
export class MetadataStorage {
  private static _defaultRegistry: MetadataRegistry | undefined;

  private constructor() {}

  /** Return the process-wide default `MetadataRegistry` (lazy-initialized). */
  public static getInstance(): MetadataRegistry {
    if (!MetadataStorage._defaultRegistry) {
      MetadataStorage._defaultRegistry = new MetadataRegistry();
    }
    return MetadataStorage._defaultRegistry;
  }

  /**
   * Replace the process-wide default registry.
   * Useful in test `beforeEach` / `afterEach` to achieve full isolation
   * without modifying existing decorator call-sites.
   */
  public static setDefaultRegistry(registry: MetadataRegistry): void {
    MetadataStorage._defaultRegistry = registry;
  }

  /** Reset the default registry to a new empty instance. */
  public static reset(): void {
    MetadataStorage._defaultRegistry = new MetadataRegistry();
  }

  // ─── Forwarding static API (backward-compatible) ─────────────────────────

  public static getEntities(): EntityMetadata[] {
    return MetadataStorage.getInstance().getEntities();
  }

  public static getEntity(target: Function): EntityMetadata | undefined {
    return MetadataStorage.getInstance().getEntity(target);
  }

  public static addEntity(target: Function, tableName?: string): void {
    MetadataStorage.getInstance().addEntity(target, tableName);
  }

  public static addColumn(target: Function, column: ColumnMetadata): void {
    MetadataStorage.getInstance().addColumn(target, column);
  }

  public static addPrimaryKey(target: Function, propertyName: string): void {
    MetadataStorage.getInstance().addPrimaryKey(target, propertyName);
  }

  public static addRelationship(target: Function, relationship: RelationshipMetadata): void {
    MetadataStorage.getInstance().addRelationship(target, relationship);
  }

  public static addIndex(target: Function, index: IndexMetadata): void {
    MetadataStorage.getInstance().addIndex(target, index);
  }

  public static addValidationRule(target: Function, rule: ValidationRule): void {
    MetadataStorage.getInstance().addValidationRule(target, rule);
  }

  public static getValidationRules(target: Function): ValidationRule[] {
    return MetadataStorage.getInstance().getValidationRules(target);
  }
}
