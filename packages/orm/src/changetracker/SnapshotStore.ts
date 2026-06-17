import {
  defaultPropertyAccessor,
  type MetadataRegistry,
  type PropertyAccessor
} from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import { complexSnapshot } from './complexValueComparer';

/**
 * Produces the `originalValues` snapshots stored against tracked entities.
 *
 * Extracted from `ChangeTracker` (refactor task-4). Combines three concerns that
 * a faithful snapshot needs:
 *  - structural clone (`structuredClone`, JSON fallback for Node < 17);
 *  - value-comparer snapshotting for columns with a configured comparer (P0-05);
 *  - by-value deep clone of complex-type properties (P1-17).
 */
export class SnapshotStore {
  constructor(private readonly registry: MetadataRegistry) {}

  /**
   * Clone `obj` for use as an `originalValues` snapshot. When `entityClass` is
   * known, applies comparer- and complex-type-aware snapshotting on top of the
   * structural clone; otherwise performs a plain structural clone.
   */
  clone<T>(obj: T, entityClass?: EntityCtorRef): T {
    const meta = entityClass ? this.registry.getEntity(entityClass) : undefined;
    if (!meta) return this.baseClone(obj);

    // structuredClone copies all enumerable own properties, including _underscored backing fields.
    const cloned = this.baseClone(obj);
    for (const col of meta.columns) {
      if (col.comparer) {
        const accessor =
          (col.accessor as PropertyAccessor | undefined) ??
          defaultPropertyAccessor(col.propertyName);
        const val = accessor.get(obj as object);
        if (val !== undefined && val !== null) {
          // Write the snapshot value back via the same accessor so it lands in the right key.
          accessor.set(cloned as object, col.comparer.snapshot(val));
        }
      }
    }
    // Ensure complex type properties are deep-cloned by value (P1-17).
    const rec = obj as Record<string, unknown>;
    const clonedRec = cloned as Record<string, unknown>;
    for (const cp of meta.complexProperties ?? []) {
      if (rec[cp.propertyName] !== undefined && rec[cp.propertyName] !== null) {
        clonedRec[cp.propertyName] = complexSnapshot(rec[cp.propertyName]);
      }
    }
    return cloned;
  }

  private baseClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    // Fallback for Node.js < 17
    return JSON.parse(JSON.stringify(obj)) as T;
  }
}
