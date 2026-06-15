import type { EntityMetadata } from '@ts-linq/types';
import { InheritanceStrategy } from '@ts-linq/types';

import type { ModelColumnSnapshot, ModelTableSnapshot } from '../../model-snapshot.types';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands inheritance hierarchies (P0-07) into the model snapshot:
 *
 * - **TPH** — adds the discriminator column to the root entity's own table.
 * - **TPT** — registers a per-subtype table (its own columns) when the subtype is
 *   not already present as a standalone entity table.
 * - **TPC** — registers a full table per concrete leaf (root columns + subtype-own
 *   columns + optional discriminator), overwriting the partial base table created
 *   for the subtype during the base sweep.
 *
 * Runs in the coordinator's second sweep so that every base table already exists.
 */
export class InheritanceExpander
  implements EntityExpander<ModelTableSnapshot, ModelColumnSnapshot>
{
  public expand(ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>): void {
    const { entity, columns } = ctx;
    const hierarchy = entity.hierarchy;
    if (!hierarchy) return;

    // TPH: add the discriminator column to this entity's own table.
    if (hierarchy.strategy === InheritanceStrategy.Tph && hierarchy.discriminator) {
      const { columnName, columnType } = hierarchy.discriminator;
      if (!columns.some((c) => c.name === columnName)) {
        columns.push({
          name: columnName,
          type: columnType.toUpperCase(),
          nullable: true,
          isPrimaryKey: false
        });
      }
    }

    if (hierarchy.strategy === InheritanceStrategy.Tpt) {
      this.expandTpt(entity, ctx);
    } else if (hierarchy.strategy === InheritanceStrategy.Tpc) {
      this.expandTpc(entity, ctx);
    }
  }

  private expandTpt(
    entity: EntityMetadata,
    ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>
  ): void {
    const { entityByType, tables, columnMapper } = ctx;
    const subtypes = entity.hierarchy?.subtypes ?? [];

    for (const subtypeCtor of subtypes) {
      const subtypeMeta = entityByType.get(subtypeCtor);
      if (!subtypeMeta) continue;
      // Skip if this table is already registered (standalone entity table).
      if (tables.has(subtypeMeta.tableName)) continue;

      const pkCols: string[] = (entity.primaryKeys ?? []).map(
        (pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName ?? pk
      );

      const subtypeColumns: ModelColumnSnapshot[] = subtypeMeta.columns.map((col) =>
        columnMapper.toModelColumn(col, { isPrimaryKey: pkCols.includes(col.columnName) })
      );

      tables.set(subtypeMeta.tableName, {
        name: subtypeMeta.tableName,
        columns: subtypeColumns,
        primaryKeys: pkCols,
        indexes: []
      });
    }
  }

  private expandTpc(
    entity: EntityMetadata,
    ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>
  ): void {
    const { entityByType, tables, columnMapper } = ctx;
    const hierarchy = entity.hierarchy;
    if (!hierarchy) return;
    const { subtypes, discriminator } = hierarchy;

    // Each concrete leaf gets a full table (root columns + subtype columns).
    const rootColumns: ModelColumnSnapshot[] = entity.columns.map((col) =>
      columnMapper.toModelColumn(col, {
        isPrimaryKey: (entity.primaryKeys ?? []).some(
          (pk) => entity.columns.find((c) => c.propertyName === pk)?.columnName === col.columnName
        )
      })
    );

    // Add the discriminator column if any (synthetic).
    if (discriminator && !rootColumns.some((c) => c.name === discriminator.columnName)) {
      rootColumns.push({
        name: discriminator.columnName,
        type: discriminator.columnType.toUpperCase(),
        nullable: true,
        isPrimaryKey: false
      });
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
          .map((col) =>
            columnMapper.toModelColumn(col, { isPrimaryKey: pkCols.includes(col.columnName) })
          )
      ];

      // Replace the partial base table (subtype-own columns) created in the base sweep,
      // or insert a fresh full table when the subtype had no standalone entry.
      tables.set(subtypeMeta.tableName, {
        name: subtypeMeta.tableName,
        columns: allCols,
        primaryKeys: pkCols,
        indexes: []
      });
    }
  }
}
