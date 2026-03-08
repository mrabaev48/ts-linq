/**
 * Clear all orphaned metadata from globalThis.
 * Should be called between tests to prevent metadata leakage.
 */
export function clearOrphanedMetadata(): void {
  type PendingMetadataState = {
    columns: WeakMap<object, unknown>;
    primaryKeys: WeakMap<object, unknown>;
    relationships: WeakMap<object, unknown>;
    indexes: WeakMap<object, unknown>;
  };
  type TsLinqGlobals = typeof globalThis & {
    __tsLinqOrphanedColumns?: unknown[];
    __tsLinqOrphanedPrimaryKeys?: unknown[];
    __tsLinqOrphanedRelationships?: unknown[];
    __tsLinqOrphanedIndexes?: unknown[];
    __tsLinqPendingMetadata?: PendingMetadataState;
  };

  const g = globalThis as TsLinqGlobals;

  if (g.__tsLinqOrphanedColumns) g.__tsLinqOrphanedColumns = [];
  if (g.__tsLinqOrphanedPrimaryKeys) g.__tsLinqOrphanedPrimaryKeys = [];
  if (g.__tsLinqOrphanedRelationships) g.__tsLinqOrphanedRelationships = [];
  if (g.__tsLinqOrphanedIndexes) g.__tsLinqOrphanedIndexes = [];
  if (g.__tsLinqPendingMetadata) {
    g.__tsLinqPendingMetadata = {
      columns: new WeakMap<object, unknown>(),
      primaryKeys: new WeakMap<object, unknown>(),
      relationships: new WeakMap<object, unknown>(),
      indexes: new WeakMap<object, unknown>()
    };
  }
}
