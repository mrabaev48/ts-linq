import type { ColumnMetadata, RelationshipMetadata, IndexMetadata, EntityMetadata, ValidationRule } from '@ts-linq/types';
/**
 * Builder for incrementally constructing `EntityMetadata` while decorators
 * are being applied. The built metadata describes table name, columns,
 * primary keys, relationships, and indexes for an entity class.
 */
export declare class EntityMetadataBuilder {
    private metadata;
    /**
     * Create a metadata builder for a specific entity constructor.
     * @param target Entity constructor function.
     */
    constructor(target: Function);
    /**
     * Override the table name stored in metadata.
     */
    setTableName(name: string): this;
    /**
     * Add a column definition to the entity.
     */
    addColumn(column: ColumnMetadata): this;
    /**
     * Add a primary key property name if not already present.
     */
    addPrimaryKey(propertyName: string): this;
    /**
     * Add a relationship definition to the entity.
     */
    addRelationship(relationship: RelationshipMetadata): this;
    /**
     * Add an index definition to the entity.
     */
    addIndex(index: IndexMetadata): this;
    /**
     * Add a validation rule to the entity.
     */
    addValidationRule(rule: ValidationRule): this;
    /**
     * Finalize and return the constructed `EntityMetadata` object.
     */
    build(): EntityMetadata;
}
//# sourceMappingURL=EntityMetadata.d.ts.map