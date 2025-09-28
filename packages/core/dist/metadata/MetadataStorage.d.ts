import type { EntityMetadata, ColumnMetadata, RelationshipMetadata, IndexMetadata } from '../types';
/**
 * Global singleton storage that collects metadata produced by decorators
 * and exposes finalized `EntityMetadata` for use by providers and loaders.
 */
export declare class MetadataStorage {
  private static instance;
  private entities;
  private builders;
  private normalizeTarget;
  private constructor();
  /** Get the singleton instance, creating it if necessary. */
  static getInstance(): MetadataStorage;
  /** Get all finalized entities' metadata. */
  static getEntities(): EntityMetadata[];
  /** Get metadata for a specific entity constructor. */
  static getEntity(target: Function): EntityMetadata | undefined;
  /** Register an entity and optionally set its table name. */
  static addEntity(target: Function, tableName?: string): void;
  /** Add column metadata for an entity. */
  static addColumn(target: Function, column: ColumnMetadata): void;
  /** Mark a property as part of the primary key. */
  static addPrimaryKey(target: Function, propertyName: string): void;
  /** Add relationship metadata for an entity. */
  static addRelationship(target: Function, relationship: RelationshipMetadata): void;
  /** Add index metadata for an entity. */
  static addIndex(target: Function, index: IndexMetadata): void;
  /**
   * Get an existing metadata builder for a target or create a new one.
   */
  private getOrCreateBuilder;
  /**
   * Register an entity constructor, optionally overriding the table name.
   * Finalization is deferred until metadata is consumed.
   */
  private registerEntity;
  /** Add a column definition to the target entity's builder or directly to finalized metadata. */
  private addColumnMetadata;
  /** Add a primary key property to the target entity's builder or into finalized metadata. */
  private addPrimaryKeyMetadata;
  /** Add a relationship definition to the target entity's builder. */
  private addRelationshipMetadata;
  /** Add an index definition to the target entity's builder. */
  private addIndexMetadata;
  /**
   * Finalize and store metadata for a given target if a builder exists.
   */
  private finalizeEntity;
  /** Get finalized `EntityMetadata` for a specific constructor. */
  getEntityMetadata(target: Function): EntityMetadata | undefined;
  /** Finalize and return metadata for all registered entities. */
  getAllEntities(): EntityMetadata[];
  /** Clear all stored metadata and pending builders. */
  clear(): void;
}
//# sourceMappingURL=MetadataStorage.d.ts.map
