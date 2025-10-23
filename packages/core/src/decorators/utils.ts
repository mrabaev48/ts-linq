/**
 * Clear all orphaned metadata from globalThis.
 * Should be called between tests to prevent metadata leakage.
 */
export function clearOrphanedMetadata(): void {
  if ((globalThis as any).__tsLinqOrphanedColumns) {
    (globalThis as any).__tsLinqOrphanedColumns = [];
  }
  if ((globalThis as any).__tsLinqOrphanedPrimaryKeys) {
    (globalThis as any).__tsLinqOrphanedPrimaryKeys = [];
  }
  if ((globalThis as any).__tsLinqOrphanedRelationships) {
    (globalThis as any).__tsLinqOrphanedRelationships = [];
  }
  if ((globalThis as any).__tsLinqOrphanedIndexes) {
    (globalThis as any).__tsLinqOrphanedIndexes = [];
  }
  if ((globalThis as any).__tsLinqPendingMetadata) {
    (globalThis as any).__tsLinqPendingMetadata = {
      columns: new WeakMap(),
      primaryKeys: new WeakMap(),
      relationships: new WeakMap(),
      indexes: new WeakMap()
    };
  }
}
