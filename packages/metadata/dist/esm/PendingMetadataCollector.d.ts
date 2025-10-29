import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';
/**
 * Temporary storage for metadata collected by field decorators
 * before @Entity finalizes and registers them in MetadataStorage.
 *
 * Uses WeakMap to avoid memory leaks - entries are garbage collected
 * when the class is no longer referenced.
 */
declare class PendingMetadataCollectorImpl {
    private columns;
    private primaryKeys;
    private indexes;
    private relationships;
    addColumn(target: Function, column: ColumnMetadata): void;
    getColumns(target: Function): Map<string, ColumnMetadata>;
    addPrimaryKey(target: Function, propertyName: string): void;
    getPrimaryKeys(target: Function): Set<string>;
    addIndex(target: Function, index: IndexMetadata): void;
    getIndexes(target: Function): IndexMetadata[];
    addRelationship(target: Function, relationship: RelationshipMetadata): void;
    getRelationships(target: Function): Map<string, RelationshipMetadata>;
    /**
     * Clear all pending metadata for a target (called by @Entity after registration).
     */
    clear(target: Function): void;
}
/**
 * Global singleton for collecting pending metadata from field decorators.
 */
export declare const PendingMetadataCollector: PendingMetadataCollectorImpl;
export {};
//# sourceMappingURL=PendingMetadataCollector.d.ts.map