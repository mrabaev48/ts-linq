import { EntityMetadata, ColumnMetadata, RelationshipMetadata, IndexMetadata } from '../types';
import { EntityMetadataBuilder } from './EntityMetadata';

export class MetadataStorage {
    private static instance: MetadataStorage;
    private entities: Map<Function, EntityMetadata> = new Map();
    private builders: Map<Function, EntityMetadataBuilder> = new Map();

    private constructor() {}

    public static getInstance(): MetadataStorage {
        if (!MetadataStorage.instance) {
            MetadataStorage.instance = new MetadataStorage();
        }
        return MetadataStorage.instance;
    }

    public static getEntities(): EntityMetadata[] {
        return MetadataStorage.getInstance().getAllEntities();
    }

    public static getEntity(target: Function): EntityMetadata | undefined {
        return MetadataStorage.getInstance().getEntityMetadata(target);
    }

    public static addEntity(target: Function, tableName?: string): void {
        MetadataStorage.getInstance().registerEntity(target, tableName);
    }

    public static addColumn(target: Function, column: ColumnMetadata): void {
        MetadataStorage.getInstance().addColumnMetadata(target, column);
    }

    public static addPrimaryKey(target: Function, propertyName: string): void {
        MetadataStorage.getInstance().addPrimaryKeyMetadata(target, propertyName);
    }

    public static addRelationship(target: Function, relationship: RelationshipMetadata): void {
        MetadataStorage.getInstance().addRelationshipMetadata(target, relationship);
    }

    public static addIndex(target: Function, index: IndexMetadata): void {
        MetadataStorage.getInstance().addIndexMetadata(target, index);
    }

    private getOrCreateBuilder(target: Function): EntityMetadataBuilder {
        if (!this.builders.has(target)) {
            this.builders.set(target, new EntityMetadataBuilder(target));
        }
        return this.builders.get(target)!;
    }

    private registerEntity(target: Function, tableName?: string): void {
        const builder = this.getOrCreateBuilder(target);
        if (tableName) {
            builder.setTableName(tableName);
        }
        this.finalizeEntity(target);
    }

    private addColumnMetadata(target: Function, column: ColumnMetadata): void {
        const builder = this.getOrCreateBuilder(target);
        builder.addColumn(column);
    }

    private addPrimaryKeyMetadata(target: Function, propertyName: string): void {
        const builder = this.getOrCreateBuilder(target);
        builder.addPrimaryKey(propertyName);
    }

    private addRelationshipMetadata(target: Function, relationship: RelationshipMetadata): void {
        const builder = this.getOrCreateBuilder(target);
        builder.addRelationship(relationship);
    }

    private addIndexMetadata(target: Function, index: IndexMetadata): void {
        const builder = this.getOrCreateBuilder(target);
        builder.addIndex(index);
    }

    private finalizeEntity(target: Function): void {
        if (this.builders.has(target)) {
            const builder = this.builders.get(target)!;
            const metadata = builder.build();
            this.entities.set(target, metadata);
            this.builders.delete(target);
        }
    }

    public getEntityMetadata(target: Function): EntityMetadata | undefined {
        if (this.builders.has(target)) {
            this.finalizeEntity(target);
        }
        return this.entities.get(target);
    }

    public getAllEntities(): EntityMetadata[] {
        // Finalize any pending builders
        for (const target of this.builders.keys()) {
            this.finalizeEntity(target);
        }
        return Array.from(this.entities.values());
    }

    public clear(): void {
        this.entities.clear();
        this.builders.clear();
    }
}
