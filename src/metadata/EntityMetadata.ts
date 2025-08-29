import { ColumnMetadata, RelationshipMetadata, IndexMetadata, EntityMetadata } from '../types';

export class EntityMetadataBuilder {
    private metadata: Partial<EntityMetadata>;

    constructor(target: Function) {
        this.metadata = {
            target,
            tableName: target.name,
            columns: [],
            primaryKeys: [],
            relationships: [],
            indexes: []
        };
    }

    public setTableName(name: string): this {
        this.metadata.tableName = name;
        return this;
    }

    public addColumn(column: ColumnMetadata): this {
        this.metadata.columns = this.metadata.columns || [];
        this.metadata.columns.push(column);
        return this;
    }

    public addPrimaryKey(propertyName: string): this {
        this.metadata.primaryKeys = this.metadata.primaryKeys || [];
        if (!this.metadata.primaryKeys.includes(propertyName)) {
            this.metadata.primaryKeys.push(propertyName);
        }
        return this;
    }

    public addRelationship(relationship: RelationshipMetadata): this {
        this.metadata.relationships = this.metadata.relationships || [];
        this.metadata.relationships.push(relationship);
        return this;
    }

    public addIndex(index: IndexMetadata): this {
        this.metadata.indexes = this.metadata.indexes || [];
        this.metadata.indexes.push(index);
        return this;
    }

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
            indexes: this.metadata.indexes || []
        };
    }
}
