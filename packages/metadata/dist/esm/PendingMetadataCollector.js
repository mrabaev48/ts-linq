/**
 * Temporary storage for metadata collected by field decorators
 * before @Entity finalizes and registers them in MetadataStorage.
 *
 * Uses WeakMap to avoid memory leaks - entries are garbage collected
 * when the class is no longer referenced.
 */
class PendingMetadataCollectorImpl {
    constructor() {
        this.columns = new WeakMap();
        this.primaryKeys = new WeakMap();
        this.indexes = new WeakMap();
        this.relationships = new WeakMap();
    }
    addColumn(target, column) {
        if (!this.columns.has(target)) {
            this.columns.set(target, new Map());
        }
        this.columns.get(target).set(column.propertyName, column);
    }
    getColumns(target) {
        return this.columns.get(target) || new Map();
    }
    addPrimaryKey(target, propertyName) {
        if (!this.primaryKeys.has(target)) {
            this.primaryKeys.set(target, new Set());
        }
        this.primaryKeys.get(target).add(propertyName);
    }
    getPrimaryKeys(target) {
        return this.primaryKeys.get(target) || new Set();
    }
    addIndex(target, index) {
        if (!this.indexes.has(target)) {
            this.indexes.set(target, []);
        }
        this.indexes.get(target).push(index);
    }
    getIndexes(target) {
        return this.indexes.get(target) || [];
    }
    addRelationship(target, relationship) {
        if (!this.relationships.has(target)) {
            this.relationships.set(target, new Map());
        }
        this.relationships.get(target).set(relationship.propertyName, relationship);
    }
    getRelationships(target) {
        return this.relationships.get(target) || new Map();
    }
    /**
     * Clear all pending metadata for a target (called by @Entity after registration).
     */
    clear(target) {
        this.columns.delete(target);
        this.primaryKeys.delete(target);
        this.indexes.delete(target);
        this.relationships.delete(target);
    }
}
/**
 * Global singleton for collecting pending metadata from field decorators.
 */
export const PendingMetadataCollector = new PendingMetadataCollectorImpl();
//# sourceMappingURL=PendingMetadataCollector.js.map