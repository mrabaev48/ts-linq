/**
 * Single source of the group-by / index-by-key mechanics shared by every
 * loader. Previously the grouping loop was duplicated across the batched
 * one-to-many and to-one paths in both loaders.
 */
export class EntityGrouper {
  /** Build a `key -> rows[]` multimap (used by to-many fan-out). */
  public groupByKey<T>(rows: readonly T[], keyOf: (row: T) => unknown): Map<unknown, T[]> {
    const map = new Map<unknown, T[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return map;
  }

  /** Build a `key -> row` index (used by to-one resolution). Last write wins. */
  public indexByKey<T>(rows: readonly T[], keyOf: (row: T) => unknown): Map<unknown, T> {
    const map = new Map<unknown, T>();
    for (const row of rows) map.set(keyOf(row), row);
    return map;
  }

  /** Deduplicate while dropping `null`/`undefined`, preserving first-seen order. */
  public uniqueDefined(values: readonly unknown[]): unknown[] {
    return Array.from(new Set(values.filter((v) => v !== undefined && v !== null)));
  }
}
