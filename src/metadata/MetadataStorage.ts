import type { EntityMetadata, ColumnMetadata, RelationshipMetadata, IndexMetadata } from '../types';
import { EntityMetadataBuilder } from './EntityMetadata';

/**
 * Global singleton storage that collects metadata produced by decorators
 * and exposes finalized `EntityMetadata` for use by providers and loaders.
 */
export class MetadataStorage {
  private static instance: MetadataStorage;
  private entities: Map<Function, EntityMetadata> = new Map();
  private builders: Map<Function, EntityMetadataBuilder> = new Map();

  private normalizeTarget<T extends Function>(target: T): T {
    // Map decorated Extended classes back to original constructors if present
    const getOwn = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
      .getOwnMetadata;
    const maybe = getOwn?.('orm:original', target);
    const original = typeof maybe === 'function' ? (maybe as T) : undefined;
    return original ?? target;
  }

  private constructor() {}

  /** Get the singleton instance, creating it if necessary. */
  public static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }

  /** Get all finalized entities' metadata. */
  public static getEntities(): EntityMetadata[] {
    return MetadataStorage.getInstance().getAllEntities();
  }

  /** Get metadata for a specific entity constructor. */
  public static getEntity(target: Function): EntityMetadata | undefined {
    const getOwn = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
      .getOwnMetadata;
    const maybe = getOwn?.('orm:original', target);
    const original = typeof maybe === 'function' ? maybe : target;
    const meta = MetadataStorage.getInstance().getEntityMetadata(original);
    if (!meta) return undefined;
    if (original !== target) {
      // Return a view of metadata with target set to the provided constructor (decorated class)
      return { ...meta, target };
    }
    return meta;
  }

  /** Register an entity and optionally set its table name. */
  public static addEntity(target: Function, tableName?: string): void {
    MetadataStorage.getInstance().registerEntity(target, tableName);
  }

  /** Add column metadata for an entity. */
  public static addColumn(target: Function, column: ColumnMetadata): void {
    MetadataStorage.getInstance().addColumnMetadata(target, column);
  }

  /** Mark a property as part of the primary key. */
  public static addPrimaryKey(target: Function, propertyName: string): void {
    MetadataStorage.getInstance().addPrimaryKeyMetadata(target, propertyName);
  }

  /** Add relationship metadata for an entity. */
  public static addRelationship(target: Function, relationship: RelationshipMetadata): void {
    MetadataStorage.getInstance().addRelationshipMetadata(target, relationship);
  }

  /** Add index metadata for an entity. */
  public static addIndex(target: Function, index: IndexMetadata): void {
    MetadataStorage.getInstance().addIndexMetadata(target, index);
  }

  /**
   * Get an existing metadata builder for a target or create a new one.
   */
  private getOrCreateBuilder(target: Function): EntityMetadataBuilder {
    const key = this.normalizeTarget(target);
    if (!this.builders.has(key)) {
      this.builders.set(key, new EntityMetadataBuilder(key));
    }
    return this.builders.get(key)!;
  }

  /**
   * Register an entity constructor, optionally overriding the table name.
   * Finalization is deferred until metadata is consumed.
   */
  private registerEntity(target: Function, tableName?: string): void {
    const builder = this.getOrCreateBuilder(target);
    if (tableName) {
      builder.setTableName(tableName);
    }
    // Do not finalize here; allow subsequent decorators to contribute
  }

  /** Add a column definition to the target entity's builder. */
  private addColumnMetadata(target: Function, column: ColumnMetadata): void {
    const builder = this.getOrCreateBuilder(target);
    builder.addColumn(column);
  }

  /** Add a primary key property to the target entity's builder. */
  private addPrimaryKeyMetadata(target: Function, propertyName: string): void {
    const builder = this.getOrCreateBuilder(target);
    builder.addPrimaryKey(propertyName);
  }

  /** Add a relationship definition to the target entity's builder. */
  private addRelationshipMetadata(target: Function, relationship: RelationshipMetadata): void {
    const builder = this.getOrCreateBuilder(target);
    builder.addRelationship(relationship);
  }

  /** Add an index definition to the target entity's builder. */
  private addIndexMetadata(target: Function, index: IndexMetadata): void {
    const builder = this.getOrCreateBuilder(target);
    builder.addIndex(index);
  }

  /**
   * Finalize and store metadata for a given target if a builder exists.
   */
  private finalizeEntity(target: Function): void {
    const key = this.normalizeTarget(target);
    if (this.builders.has(key)) {
      const builder = this.builders.get(key)!;
      const metadata = builder.build();
      this.entities.set(key, metadata);
      this.builders.delete(key);
    }
  }

  /** Get finalized `EntityMetadata` for a specific constructor. */
  public getEntityMetadata(target: Function): EntityMetadata | undefined {
    const key = this.normalizeTarget(target);
    if (this.builders.has(key)) {
      this.finalizeEntity(key);
    }
    return this.entities.get(key);
  }

  /** Finalize and return metadata for all registered entities. */
  public getAllEntities(): EntityMetadata[] {
    // Finalize any pending builders
    for (const target of this.builders.keys()) {
      this.finalizeEntity(target);
    }
    return Array.from(this.entities.values());
  }

  /** Clear all stored metadata and pending builders. */
  public clear(): void {
    this.entities.clear();
    this.builders.clear();
  }
}
