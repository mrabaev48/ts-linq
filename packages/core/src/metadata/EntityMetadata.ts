import type { ColumnMetadata, RelationshipMetadata, IndexMetadata, EntityMetadata } from '../types';

/**
 * Builder for incrementally constructing `EntityMetadata` while decorators
 * are being applied. The built metadata describes table name, columns,
 * primary keys, relationships, and indexes for an entity class.
 */
export class EntityMetadataBuilder {
  private metadata: Partial<EntityMetadata>;

  /**
   * Create a metadata builder for a specific entity constructor.
   * @param target Entity constructor function.
   */
  constructor(target: Function) {
    this.metadata = {
      target,
      tableName:
        ((
          Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown }
        ).getOwnMetadata?.('orm:tableName', target) as string) || target.name,
      columns: [],
      primaryKeys: [],
      relationships: [],
      indexes: []
    };
  }

  /**
   * Override the table name stored in metadata.
   */
  public setTableName(name: string): this {
    this.metadata.tableName = name;
    return this;
  }

  /**
   * Add a column definition to the entity.
   */
  public addColumn(column: ColumnMetadata): this {
    this.metadata.columns = this.metadata.columns || [];
    this.metadata.columns.push(column);
    return this;
  }

  /**
   * Add a primary key property name if not already present.
   */
  public addPrimaryKey(propertyName: string): this {
    this.metadata.primaryKeys = this.metadata.primaryKeys || [];
    if (!this.metadata.primaryKeys.includes(propertyName)) {
      this.metadata.primaryKeys.push(propertyName);
    }
    return this;
  }

  /**
   * Add a relationship definition to the entity.
   */
  public addRelationship(relationship: RelationshipMetadata): this {
    this.metadata.relationships = this.metadata.relationships || [];
    this.metadata.relationships.push(relationship);
    return this;
  }

  /**
   * Add an index definition to the entity.
   */
  public addIndex(index: IndexMetadata): this {
    this.metadata.indexes = this.metadata.indexes || [];
    this.metadata.indexes.push(index);
    return this;
  }

  /**
   * Finalize and return the constructed `EntityMetadata` object.
   */
  public build(): EntityMetadata {
    if (!this.metadata.target) {
      throw new Error('Entity target is required');
    }

    return {
      target: this.metadata.target,
      tableName:
        this.metadata.tableName ||
        ((
          Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown }
        ).getOwnMetadata?.('orm:tableName', this.metadata.target) as string) ||
        this.metadata.target.name,
      columns: this.metadata.columns || [],
      primaryKeys: this.metadata.primaryKeys || [],
      relationships: this.metadata.relationships || [],
      indexes: this.metadata.indexes || []
    };
  }
}
