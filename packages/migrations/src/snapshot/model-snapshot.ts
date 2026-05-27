import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata, EntityMetadata, IndexMetadata } from '@ts-linq/types';

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

/**
 * Builds a deterministic `ModelSnapshot` from the current `MetadataStorage`.
 * All collections are sorted alphabetically so the JSON output is stable
 * across runs regardless of decorator execution order.
 */
export class ModelSnapshotBuilder {
  /**
   * Serialize all registered entities into a `ModelSnapshot`.
   * The result is canonical: tables sorted by name, columns sorted by name,
   * indexes sorted by name, index columns sorted alphabetically.
   */
  public buildFromMetadata(): ModelSnapshot {
    const entities = MetadataStorage.getEntities();

    const tables: ModelTableSnapshot[] = entities
      .map((entity: EntityMetadata): ModelTableSnapshot => {
        const primaryKeyProps: string[] = entity.primaryKeys ?? [];

        const columns: ModelColumnSnapshot[] = entity.columns
          .map(
            (col: ColumnMetadata): ModelColumnSnapshot => ({
              name: col.columnName,
              type: String(col.type ?? '').toUpperCase(),
              nullable: col.nullable ?? true,
              isPrimaryKey: primaryKeyProps.includes(col.propertyName),
              defaultValue: col.defaultValue,
              defaultExpression: col.defaultExpression
            })
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        const primaryKeys: string[] = primaryKeyProps
          .map((pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName ?? pk)
          .sort();

        const indexes: ModelIndexSnapshot[] = ((entity.indexes ?? []) as IndexMetadata[])
          .map(
            (idx): ModelIndexSnapshot => ({
              name: idx.name,
              columns: [...idx.columns].sort(),
              unique: !!idx.unique,
              where: idx.where
            })
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          name: entity.tableName,
          columns,
          primaryKeys,
          indexes
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { version: 1, tables };
  }
}

/**
 * Serializes and deserializes `ModelSnapshot` to/from JSON.
 */
export class ModelSnapshotSerializer {
  /**
   * Convert a `ModelSnapshot` to a deterministic JSON string.
   */
  public serialize(snapshot: ModelSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Parse and validate a JSON string into a `ModelSnapshot`.
   * @throws {Error} When the JSON structure is not a valid `ModelSnapshot`.
   */
  public deserialize(json: string): ModelSnapshot {
    const obj: unknown = JSON.parse(json);
    this.assertValid(obj);
    return obj;
  }

  private assertValid(obj: unknown): asserts obj is ModelSnapshot {
    if (
      !obj ||
      typeof obj !== 'object' ||
      !Array.isArray((obj as Record<string, unknown>).tables)
    ) {
      throw new Error('Invalid ModelSnapshot: expected an object with a "tables" array property.');
    }
  }
}
