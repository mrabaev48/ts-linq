import type {
  ColumnMetadata,
  EntityMetadata,
  IndexMetadata,
  RelationshipMetadata,
  ValidationRule
} from '@ts-linq/types';

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
      tableName: target.name, // Default to class name, can be overridden by setTableName
      columns: [],
      primaryKeys: [],
      relationships: [],
      indexes: [],
      validations: []
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
   * Add a validation rule to the entity.
   */
  public addValidationRule(rule: ValidationRule): this {
    this.metadata.validations = this.metadata.validations || [];
    this.metadata.validations.push(rule);
    return this;
  }

  /** Replace primary keys (fluent override semantics). */
  public setPrimaryKeys(keys: string[]): this {
    this.metadata.primaryKeys = [...keys];
    return this;
  }

  /** Merge/override a column by propertyName (fluent override semantics). */
  public mergeColumn(column: ColumnMetadata): this {
    this.metadata.columns = this.metadata.columns || [];
    const idx = this.metadata.columns.findIndex((c) => c.propertyName === column.propertyName);
    if (idx >= 0) {
      this.metadata.columns[idx] = { ...this.metadata.columns[idx], ...column };
    } else {
      this.metadata.columns.push(column);
    }
    return this;
  }

  /** Merge/override a relationship by propertyName (fluent override semantics). */
  public mergeRelationship(relationship: RelationshipMetadata): this {
    this.metadata.relationships = this.metadata.relationships || [];
    const idx = this.metadata.relationships.findIndex(
      (r) => r.propertyName === relationship.propertyName
    );
    if (idx >= 0) {
      this.metadata.relationships[idx] = relationship;
    } else {
      this.metadata.relationships.push(relationship);
    }
    return this;
  }

  /** Merge/override an index by name (fluent override semantics). */
  public mergeIndex(index: IndexMetadata): this {
    this.metadata.indexes = this.metadata.indexes || [];
    const idx = this.metadata.indexes.findIndex((i) => i.name === index.name);
    if (idx >= 0) {
      this.metadata.indexes[idx] = index;
    } else {
      this.metadata.indexes.push(index);
    }
    return this;
  }

  /** Set schema for the entity. */
  public setSchema(schema: string): this {
    this.metadata.schema = schema;
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
      tableName: this.metadata.tableName || this.metadata.target.name,
      columns: this.metadata.columns || [],
      primaryKeys: this.metadata.primaryKeys || [],
      relationships: this.metadata.relationships || [],
      indexes: this.metadata.indexes || [],
      validations: this.metadata.validations || [],
      ...(this.metadata.schema !== undefined ? { schema: this.metadata.schema } : {})
    };
  }
}
