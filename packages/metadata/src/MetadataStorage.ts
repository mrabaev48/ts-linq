import type {
  ColumnMetadata,
  EntityMetadata,
  HierarchyMetadata,
  IndexMetadata,
  RelationshipMetadata,
  SkipNavigationMetadata,
  ValidationRule
} from '@ts-linq/types';

import { MetadataRegistry } from './MetadataRegistry';

/**
 * Process-wide façade over a lazily-initialized `MetadataRegistry` singleton.
 *
 * ## How decorators interact with this class
 * Every decorator (`@Entity`, `@Column`, `@PrimaryKey`, `@Relationship`, `@ValidIf`)
 * calls the static methods below, which forward to `getInstance()`.  Because class
 * decorators execute at **module load time**, the metadata is registered in the
 * singleton before any test setup code runs.
 *
 * ## Test isolation
 * For tests that **manually** register entities inside test bodies (no decorator
 * syntax on module-level classes), call `MetadataStorage.reset()` in `beforeEach`
 * to start each test with a clean registry:
 *
 * ```ts
 * beforeEach(() => MetadataStorage.reset());
 * ```
 *
 * For tests that use module-level decorated classes, the decorators run once when
 * the module loads and cannot be re-executed.  Use `getInstance().clear()` in
 * `afterEach` only if your tests mutate registered metadata between runs.
 *
 * ## Multi-tenant isolation
 * Create independent registries with `createMetadataRegistry()` and populate them
 * programmatically, then pass each registry to `DbContextOptions.registry`:
 *
 * ```ts
 * import { createMetadataRegistry } from '@ts-linq/metadata';
 *
 * const tenantRegistry = createMetadataRegistry();
 * tenantRegistry.addEntity(User, 'tenant_users');
 * const ctx = new DbContext({ provider, registry: tenantRegistry });
 * ```
 *
 * A `DbContext` initialized with an explicit registry uses **only** that registry —
 * it does not inherit entities from the singleton.
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

  /**
   * Replace the default registry with a new, empty instance.
   *
   * Call in `beforeEach` for test suites that register entities programmatically
   * (i.e. by calling `addEntity` / `addColumn` inside test bodies rather than
   * relying on module-level class decorators).
   */
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

  public static setHierarchyMetadata(target: Function, h: HierarchyMetadata): void {
    MetadataStorage.getInstance().setHierarchyMetadata(target, h);
  }

  public static setHierarchyRoot(subtype: Function, root: Function): void {
    MetadataStorage.getInstance().setHierarchyRoot(subtype, root);
  }

  public static mergeFluentSkipNavigation(target: Function, nav: SkipNavigationMetadata): void {
    MetadataStorage.getInstance().mergeFluentSkipNavigation(target, nav);
  }

  public static setSeedData(target: Function, rows: Record<string, unknown>[]): void {
    MetadataStorage.getInstance().setSeedData(target, rows);
  }

  public static clear(): void {
    MetadataStorage.getInstance().clear();
  }
}
