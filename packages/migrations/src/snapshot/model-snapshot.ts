import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  EntityMetadata,
  IndexMetadata,
  OwnedEntityMetadata
} from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

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
    const entityByType = new Map<Function, EntityMetadata>(
      entities.filter((e) => e.target).map((e) => [e.target!, e])
    );

    const extraTables: ModelTableSnapshot[] = [];

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

        // Expand owned entity columns into the owner table snapshot
        for (const owned of entity.ownedEntities ?? []) {
          this._expandOwnedEntity(owned, entity, entityByType, columns, extraTables);
        }

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

        columns.sort((a, b) => a.name.localeCompare(b.name));

        return {
          name: entity.tableName,
          columns,
          primaryKeys,
          indexes
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      version: 1,
      tables: [...tables, ...extraTables].sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  private _expandOwnedEntity(
    owned: OwnedEntityMetadata,
    ownerEntity: EntityMetadata,
    entityByType: Map<Function, EntityMetadata>,
    ownerColumns: ModelColumnSnapshot[],
    extraTables: ModelTableSnapshot[]
  ): void {
    const ownedEntityMeta = entityByType.get(owned.ownedType);

    if (owned.strategy === StorageStrategy.TableSplit) {
      const prefix = owned.columnPrefix ?? `${owned.ownerPropertyName}_`;
      const sourceCols: ColumnMetadata[] = ownedEntityMeta?.columns ?? [];
      for (const col of sourceCols) {
        ownerColumns.push({
          name: `${prefix}${col.columnName}`,
          type: String(col.type ?? '').toUpperCase(),
          nullable: col.nullable ?? true,
          isPrimaryKey: false,
          defaultValue: col.defaultValue,
          defaultExpression: col.defaultExpression
        });
      }
    } else if (owned.strategy === StorageStrategy.Json) {
      const jsonCol = owned.jsonColumnName ?? owned.ownerPropertyName;
      ownerColumns.push({
        name: jsonCol,
        type: 'JSON',
        nullable: true,
        isPrimaryKey: false
      });
    } else if (owned.strategy === StorageStrategy.SeparateTable) {
      const ownedTableName = ownedEntityMeta?.tableName ?? owned.ownerPropertyName;
      const ownerPrimaryKeys = ownerEntity.primaryKeys ?? [];
      const fkColumns: ModelColumnSnapshot[] =
        owned.foreignKeyColumns?.map((fk) => ({
          name: fk,
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: true
        })) ??
        ownerPrimaryKeys.map((pk) => {
          const col = ownerEntity.columns.find((c) => c.propertyName === pk);
          return {
            name: `${ownerEntity.tableName}_${col?.columnName ?? pk}`,
            type: String(col?.type ?? 'INTEGER').toUpperCase(),
            nullable: false,
            isPrimaryKey: true
          };
        });

      const ownedCols: ModelColumnSnapshot[] = (ownedEntityMeta?.columns ?? []).map((col) => ({
        name: col.columnName,
        type: String(col.type ?? '').toUpperCase(),
        nullable: col.nullable ?? true,
        isPrimaryKey: false,
        defaultValue: col.defaultValue,
        defaultExpression: col.defaultExpression
      }));

      const allCols = [...fkColumns, ...ownedCols].sort((a, b) => a.name.localeCompare(b.name));
      const primaryKeys = fkColumns.map((c) => c.name).sort();

      extraTables.push({
        name: ownedTableName,
        columns: allCols,
        primaryKeys,
        indexes: []
      });
    }
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
