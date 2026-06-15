import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityMetadata, IndexMetadata } from '@ts-linq/types';
import { SnapshotSerializationError, SnapshotValidationError } from '@ts-linq/types';

import { ColumnMapper } from './expanders/ColumnMapper';
import type { EntityExpander, ExpansionContext } from './expanders/EntityExpander';
import { ComplexTypeExpander } from './expanders/model/ComplexTypeExpander';
import { InheritanceExpander } from './expanders/model/InheritanceExpander';
import { OwnedEntityExpander } from './expanders/model/OwnedEntityExpander';
import { SkipNavigationExpander } from './expanders/model/SkipNavigationExpander';
import type {
  ModelColumnSnapshot,
  ModelIndexSnapshot,
  ModelSnapshot,
  ModelTableSnapshot
} from './model-snapshot.types';

// Re-export the snapshot value types so the public package surface is unchanged.
export type {
  ModelColumnSnapshot,
  ModelIndexSnapshot,
  ModelSnapshot,
  ModelTableSnapshot
} from './model-snapshot.types';

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
 * Builds a deterministic `ModelSnapshot` from a set of entities.
 *
 * The builder is a thin coordinator: it builds one base table per entity, then runs
 * an ordered list of {@link EntityExpander} strategies (owned entities, complex types,
 * inheritance, skip-navigation join tables) over each entity. All canonical sorting
 * (tables / columns / indexes / primary keys) happens once, here in the coordinator,
 * so the JSON output is stable regardless of decorator execution order.
 *
 * The entity list is injected via {@link ModelSnapshotBuilder.buildFrom}; the no-arg
 * {@link ModelSnapshotBuilder.buildFromMetadata} reads the global `MetadataStorage`
 * for back-compatibility.
 */
export class ModelSnapshotBuilder {
  private readonly columnMapper = new ColumnMapper();
  private readonly expanders: ReadonlyArray<
    EntityExpander<ModelTableSnapshot, ModelColumnSnapshot>
  > = [
    new OwnedEntityExpander(),
    new ComplexTypeExpander(),
    new InheritanceExpander(),
    new SkipNavigationExpander()
  ];

  /**
   * Serialize all globally registered entities into a `ModelSnapshot`.
   * Back-compat entrypoint reading the global `MetadataStorage` singleton.
   */
  public buildFromMetadata(): ModelSnapshot {
    return this.buildFrom(MetadataStorage.getEntities());
  }

  /**
   * Serialize an injected set of entities into a canonical `ModelSnapshot`:
   * tables sorted by name, columns sorted by name, indexes sorted by name with
   * sorted columns. Inverts the global-registry coupling (testable in isolation).
   */
  public buildFrom(entities: ReadonlyArray<EntityMetadata>): ModelSnapshot {
    const entityByType = new Map<Function | string, EntityMetadata>(
      entities.filter((e) => e.target).map((e) => [e.target!, e])
    );

    const tables = new Map<string, ModelTableSnapshot>();

    // Sweep 1: one base table per entity (so the inheritance/skip-nav expanders in
    // sweep 2 can see every table — e.g. TPC overwrites a subtype's partial table).
    for (const entity of entities) {
      tables.set(entity.tableName, this.buildBaseTable(entity));
    }

    // Sweep 2: run the ordered expanders over each entity.
    for (const entity of entities) {
      const table = tables.get(entity.tableName);
      if (!table) continue;
      const ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot> = {
        entity,
        entityByType,
        columns: table.columns,
        tables,
        columnMapper: this.columnMapper
      };
      for (const expander of this.expanders) {
        expander.expand(ctx);
      }
    }

    return { version: 1, tables: this.finalize(tables) };
  }

  /** Build the entity's own table (base columns + indexes + seed data). */
  private buildBaseTable(entity: EntityMetadata): ModelTableSnapshot {
    const primaryKeyProps: string[] = entity.primaryKeys ?? [];

    const columns: ModelColumnSnapshot[] = entity.columns.map((col) =>
      this.columnMapper.toModelColumn(col, {
        isPrimaryKey: primaryKeyProps.includes(col.propertyName)
      })
    );

    const primaryKeys: string[] = primaryKeyProps
      .map((pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName ?? pk)
      .sort();

    const indexes: ModelIndexSnapshot[] = ((entity.indexes ?? []) as IndexMetadata[]).map(
      (idx): ModelIndexSnapshot => ({
        name: idx.name,
        columns: [...idx.columns],
        unique: !!idx.unique,
        where: idx.where
      })
    );

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
  }

  /** Centralized canonical sort applied to every emitted table. */
  private finalize(tables: Map<string, ModelTableSnapshot>): ModelTableSnapshot[] {
    const result = [...tables.values()];
    for (const table of result) {
      table.columns.sort((a, b) => a.name.localeCompare(b.name));
      table.primaryKeys.sort();
      for (const index of table.indexes) {
        index.columns.sort();
      }
      table.indexes.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
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
