/**
 * Builder for incrementally constructing `EntityMetadata` while decorators
 * are being applied. The built metadata describes table name, columns,
 * primary keys, relationships, and indexes for an entity class.
 */
export class EntityMetadataBuilder {
    /**
     * Create a metadata builder for a specific entity constructor.
     * @param target Entity constructor function.
     */
    constructor(target) {
        this.metadata = {
            target,
            tableName: Reflect.getOwnMetadata?.('orm:tableName', target) || target.name,
            columns: [],
            primaryKeys: [],
            relationships: [],
            indexes: []
        };
    }
    /**
     * Override the table name stored in metadata.
     */
    setTableName(name) {
        this.metadata.tableName = name;
        return this;
    }
    /**
     * Add a column definition to the entity.
     */
    addColumn(column) {
        this.metadata.columns = this.metadata.columns || [];
        this.metadata.columns.push(column);
        return this;
    }
    /**
     * Add a primary key property name if not already present.
     */
    addPrimaryKey(propertyName) {
        this.metadata.primaryKeys = this.metadata.primaryKeys || [];
        if (!this.metadata.primaryKeys.includes(propertyName)) {
            this.metadata.primaryKeys.push(propertyName);
        }
        return this;
    }
    /**
     * Add a relationship definition to the entity.
     */
    addRelationship(relationship) {
        this.metadata.relationships = this.metadata.relationships || [];
        this.metadata.relationships.push(relationship);
        return this;
    }
    /**
     * Add an index definition to the entity.
     */
    addIndex(index) {
        this.metadata.indexes = this.metadata.indexes || [];
        this.metadata.indexes.push(index);
        return this;
    }
    /**
     * Finalize and return the constructed `EntityMetadata` object.
     */
    build() {
        if (!this.metadata.target) {
            throw new Error('Entity target is required');
        }
        return {
            target: this.metadata.target,
            tableName: this.metadata.tableName ||
                Reflect.getOwnMetadata?.('orm:tableName', this.metadata.target) ||
                this.metadata.target.name,
            columns: this.metadata.columns || [],
            primaryKeys: this.metadata.primaryKeys || [],
            relationships: this.metadata.relationships || [],
            indexes: this.metadata.indexes || []
        };
    }
}
//# sourceMappingURL=EntityMetadata.js.map