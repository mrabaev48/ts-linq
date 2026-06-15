/**
 * Public snapshot value types for the model snapshot.
 *
 * These interfaces are extracted into a standalone module (away from
 * `model-snapshot.ts`) so that the `ColumnMapper` and the strategy expanders can
 * depend on the snapshot shapes without creating a file-level import cycle with
 * the `ModelSnapshotBuilder` coordinator. `model-snapshot.ts` re-exports them, so
 * the public package surface is unchanged.
 */

/**
 * A normalized snapshot of a single column in the model.
 * Used for change-detection between two model states.
 */
export interface ModelColumnSnapshot {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: unknown;
  defaultExpression?: string;
}

/**
 * A normalized snapshot of a single table (entity) in the model.
 */
export interface ModelTableSnapshot {
  name: string;
  columns: ModelColumnSnapshot[];
  primaryKeys: string[];
  indexes: ModelIndexSnapshot[];
  /** Seed rows declared via hasData(), keyed by column names. Sorted by PK for stable JSON. */
  seedData?: Record<string, unknown>[];
}

/**
 * A normalized snapshot of an index in the model.
 */
export interface ModelIndexSnapshot {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
}

/**
 * A deterministic, versioned snapshot of the full application model.
 * Can be serialized to JSON and stored alongside migrations to detect model drift.
 *
 * Mirrors EF Core's model snapshot concept used by `HasPendingModelChanges()`.
 *
 * @example
 * const builder = new ModelSnapshotBuilder();
 * const snapshot = builder.buildFromMetadata();
 * const json = new ModelSnapshotSerializer().serialize(snapshot);
 * fs.writeFileSync('model.snapshot.json', json);
 */
export interface ModelSnapshot {
  /** Schema version — increment when the snapshot structure itself changes. */
  readonly version: 1;
  readonly tables: ModelTableSnapshot[];
}
