/**
 * Clear all orphaned metadata from globalThis.
 * Should be called between tests to prevent metadata leakage.
 */
export function clearOrphanedMetadata() {
    if (globalThis.__tsLinqOrphanedColumns) {
        globalThis.__tsLinqOrphanedColumns = [];
    }
    if (globalThis.__tsLinqOrphanedPrimaryKeys) {
        globalThis.__tsLinqOrphanedPrimaryKeys = [];
    }
    if (globalThis.__tsLinqOrphanedRelationships) {
        globalThis.__tsLinqOrphanedRelationships = [];
    }
    if (globalThis.__tsLinqOrphanedIndexes) {
        globalThis.__tsLinqOrphanedIndexes = [];
    }
    if (globalThis.__tsLinqPendingMetadata) {
        globalThis.__tsLinqPendingMetadata = {
            columns: new WeakMap(),
            primaryKeys: new WeakMap(),
            relationships: new WeakMap(),
            indexes: new WeakMap()
        };
    }
}
//# sourceMappingURL=utils.js.map