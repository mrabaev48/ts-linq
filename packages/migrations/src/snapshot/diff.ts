import type { ModelColumnSnapshot, ModelSnapshot, ModelTableSnapshot } from './model-snapshot';

/**
 * Describes a change to a single column between two model snapshots.
 */
export interface ModelColumnDiff {
  kind: 'added' | 'removed' | 'changed';
  column: string;
  before?: ModelColumnSnapshot;
  after?: ModelColumnSnapshot;
}

/**
 * Describes a change to a single table between two model snapshots.
 */
export interface ModelTableDiff {
  table: string;
  kind: 'added' | 'removed' | 'changed';
  columnDiffs?: ModelColumnDiff[];
}

/**
 * The result of comparing two `ModelSnapshot` instances.
 */
export interface ModelDiff {
  /** `true` when at least one structural difference was detected. */
  readonly hasDifferences: boolean;
  /** Per-table breakdown of detected changes. */
  readonly tableDiffs: ModelTableDiff[];
}

/**
 * Compares two `ModelSnapshot` instances and returns a structured diff.
 *
 * Used by `hasPendingModelChanges()` to determine whether the application model
 * has drifted from the last committed migration snapshot.
 *
 * @example
 * const differ = new ModelSnapshotDiff();
 * const diff = differ.compare(storedSnapshot, currentSnapshot);
 * if (diff.hasDifferences) {
 *   console.warn('Model has changed — please generate a new migration.');
 * }
 */
export class ModelSnapshotDiff {
  /**
   * Compare `before` (stored/applied snapshot) with `after` (current model snapshot).
   * Returns a `ModelDiff` describing all structural differences found.
   */
  public compare(before: ModelSnapshot, after: ModelSnapshot): ModelDiff {
    const tableDiffs: ModelTableDiff[] = [];

    const beforeMap = new Map(before.tables.map((t) => [t.name, t]));
    const afterMap = new Map(after.tables.map((t) => [t.name, t]));

    for (const [name] of afterMap) {
      if (!beforeMap.has(name)) {
        tableDiffs.push({ table: name, kind: 'added' });
      }
    }

    for (const [name] of beforeMap) {
      if (!afterMap.has(name)) {
        tableDiffs.push({ table: name, kind: 'removed' });
      }
    }

    for (const [name, afterTable] of afterMap) {
      const beforeTable = beforeMap.get(name);
      if (!beforeTable) continue;

      const columnDiffs = this.compareColumns(beforeTable, afterTable);
      if (columnDiffs.length > 0) {
        tableDiffs.push({ table: name, kind: 'changed', columnDiffs });
      }
    }

    return {
      hasDifferences: tableDiffs.length > 0,
      tableDiffs
    };
  }

  private compareColumns(before: ModelTableSnapshot, after: ModelTableSnapshot): ModelColumnDiff[] {
    const diffs: ModelColumnDiff[] = [];

    const beforeMap = new Map(before.columns.map((c) => [c.name, c]));
    const afterMap = new Map(after.columns.map((c) => [c.name, c]));

    for (const [name, col] of afterMap) {
      if (!beforeMap.has(name)) {
        diffs.push({ kind: 'added', column: name, after: col });
      }
    }

    for (const [name, col] of beforeMap) {
      if (!afterMap.has(name)) {
        diffs.push({ kind: 'removed', column: name, before: col });
      }
    }

    for (const [name, afterCol] of afterMap) {
      const beforeCol = beforeMap.get(name);
      if (!beforeCol) continue;

      const hasChanges =
        beforeCol.type !== afterCol.type ||
        beforeCol.nullable !== afterCol.nullable ||
        beforeCol.isPrimaryKey !== afterCol.isPrimaryKey;

      if (hasChanges) {
        diffs.push({ kind: 'changed', column: name, before: beforeCol, after: afterCol });
      }
    }

    return diffs;
  }
}
