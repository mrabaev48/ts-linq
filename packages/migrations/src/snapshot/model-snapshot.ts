import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  ComplexTypePropertyMetadata,
  EntityMetadata,
  IndexMetadata,
  OwnedEntityMetadata
} from '@ts-linq/types';
import {
  InheritanceStrategy,
  SnapshotSerializationError,
  SnapshotValidationError,
  StorageStrategy
} from '@ts-linq/types';

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

function comparePkValue(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function sortSeedRows(
  rows: Record<string, unknown>[],
  pkColumns: string[]
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    for (const pk of pkColumns) {
      const cmp = comparePkValue(a[pk], b[pk]);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
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

        // Expand complex type columns into the owner table snapshot (P1-17)
        for (const cp of entity.complexProperties ?? []) {
          this._expandComplexProperty(cp, cp.columnPrefix, columns);
        }

        // TPH: add discriminator column to the root entity table
        if (
          entity.hierarchy?.strategy === InheritanceStrategy.Tph &&
          entity.hierarchy.discriminator
        ) {
          const { columnName, columnType } = entity.hierarchy.discriminator;
          if (!columns.some((c) => c.name === columnName)) {
            columns.push({
              name: columnName,
              type: columnType.toUpperCase(),
              nullable: true,
              isPrimaryKey: false
            });
          }
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

        const seedData = entity.seedData?.length
          ? sortSeedRows(entity.seedData, primaryKeys)
          : undefined;

        return {
          name: entity.tableName,
          columns,
          primaryKeys,
          indexes,
          ...(seedData !== undefined ? { seedData } : {})
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // TPT / TPC: register subtype tables
    for (const entity of entities) {
      if (!entity.hierarchy) continue;

      const { strategy, subtypes, discriminator } = entity.hierarchy;

      if (strategy === InheritanceStrategy.Tpt) {
        // Each subtype gets its own table with its own columns + FK to root PK
        for (const subtypeCtor of subtypes) {
          const subtypeMeta = entityByType.get(subtypeCtor);
          if (!subtypeMeta) continue;
          // Skip if this table is already in the main tables list
          if (tables.some((t) => t.name === subtypeMeta.tableName)) continue;

          const pkCols: string[] = (entity.primaryKeys ?? []).map(
            (pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName ?? pk
          );

          const subtypeColumns: ModelColumnSnapshot[] = subtypeMeta.columns
            .map(
              (col): ModelColumnSnapshot => ({
                name: col.columnName,
                type: String(col.type ?? '').toUpperCase(),
                nullable: col.nullable ?? true,
                isPrimaryKey: pkCols.includes(col.columnName)
              })
            )
            .sort((a, b) => a.name.localeCompare(b.name));

          extraTables.push({
            name: subtypeMeta.tableName,
            columns: subtypeColumns,
            primaryKeys: pkCols.sort(),
            indexes: []
          });
        }
      } else if (strategy === InheritanceStrategy.Tpc) {
        // Each concrete leaf gets a full table (root columns + subtype columns)
        const rootColumns: ModelColumnSnapshot[] = entity.columns.map(
          (col): ModelColumnSnapshot => ({
            name: col.columnName,
            type: String(col.type ?? '').toUpperCase(),
            nullable: col.nullable ?? true,
            isPrimaryKey: (entity.primaryKeys ?? []).some(
              (pk) =>
                entity.columns.find((c) => c.propertyName === pk)?.columnName === col.columnName
            )
          })
        );
        // Add discriminator column if any (synthetic)
        if (discriminator) {
          if (!rootColumns.some((c) => c.name === discriminator.columnName)) {
            rootColumns.push({
              name: discriminator.columnName,
              type: discriminator.columnType.toUpperCase(),
              nullable: true,
              isPrimaryKey: false
            });
          }
        }

        for (const subtypeCtor of subtypes) {
          const subtypeMeta = entityByType.get(subtypeCtor);
          if (!subtypeMeta) continue;
          const pkCols: string[] = (entity.primaryKeys ?? []).map(
            (pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName ?? pk
          );

          const allCols: ModelColumnSnapshot[] = [
            ...rootColumns,
            ...subtypeMeta.columns
              .filter((col) => !rootColumns.some((rc) => rc.name === col.columnName))
              .map(
                (col): ModelColumnSnapshot => ({
                  name: col.columnName,
                  type: String(col.type ?? '').toUpperCase(),
                  nullable: col.nullable ?? true,
                  isPrimaryKey: pkCols.includes(col.columnName)
                })
              )
          ].sort((a, b) => a.name.localeCompare(b.name));

          const fullTable: ModelTableSnapshot = {
            name: subtypeMeta.tableName,
            columns: allCols,
            primaryKeys: pkCols.sort(),
            indexes: []
          };

          // Replace the partial-column table created in the main loop (TPC subtypes have
          // separate table entries but they only contain subtype-own columns at that point)
          const existingIdx = tables.findIndex((t) => t.name === subtypeMeta.tableName);
          if (existingIdx >= 0) {
            tables[existingIdx] = fullTable;
          } else {
            extraTables.push(fullTable);
          }
        }
      }
    }

    // Skip navigation join tables (many-to-many, synthesized)
    const emittedJoinTables = new Set<string>();
    for (const entity of entities) {
      for (const sn of entity.skipNavigations ?? []) {
        if (!sn.isSynthesized) continue;
        if (emittedJoinTables.has(sn.joinTableName)) continue;
        emittedJoinTables.add(sn.joinTableName);
        const pks = [sn.leftForeignKey, sn.rightForeignKey].sort();
        extraTables.push({
          name: sn.joinTableName,
          columns: [
            { name: sn.leftForeignKey, type: 'INT', nullable: false, isPrimaryKey: true },
            { name: sn.rightForeignKey, type: 'INT', nullable: false, isPrimaryKey: true }
          ].sort((a, b) => a.name.localeCompare(b.name)),
          primaryKeys: pks,
          indexes: []
        });
      }
    }

    return {
      version: 1,
      tables: [...tables, ...extraTables].sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  private _expandComplexProperty(
    complex: ComplexTypePropertyMetadata,
    prefix: string,
    ownerColumns: ModelColumnSnapshot[]
  ): void {
    for (const col of complex.properties) {
      ownerColumns.push({
        name: `${prefix}${col.columnName}`,
        type: String(col.type ?? '').toUpperCase(),
        nullable: !complex.isRequired || (col.nullable ?? true),
        isPrimaryKey: false,
        defaultValue: col.defaultValue,
        defaultExpression: col.defaultExpression
      });
    }

    for (const nested of complex.nested) {
      this._expandComplexProperty(nested, `${prefix}${nested.columnPrefix}`, ownerColumns);
    }
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
      // Use JSONB as the canonical abstract type for JSON-strategy columns.
      // Dialects map: Postgres → JSONB, MySQL → JSON, MSSQL → NVARCHAR(MAX).
      ownerColumns.push({
        name: jsonCol,
        type: 'JSONB',
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
   * @throws {SnapshotSerializationError} When the JSON cannot be parsed.
   * @throws {SnapshotValidationError} When the parsed structure is not a valid `ModelSnapshot`.
   */
  public deserialize(json: string): ModelSnapshot {
    let obj: unknown;
    try {
      obj = JSON.parse(json);
    } catch (error) {
      throw new SnapshotSerializationError('Failed to parse ModelSnapshot JSON', { cause: error });
    }
    this.assertValid(obj);
    return obj;
  }

  private assertValid(obj: unknown): asserts obj is ModelSnapshot {
    if (
      !obj ||
      typeof obj !== 'object' ||
      !Array.isArray((obj as Record<string, unknown>).tables)
    ) {
      throw new SnapshotValidationError(
        'Invalid ModelSnapshot: expected an object with a "tables" array property'
      );
    }
  }
}
