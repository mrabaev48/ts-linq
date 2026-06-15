import type { ColumnMetadata, OwnedEntityMetadata } from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

import type { ModelColumnSnapshot, ModelTableSnapshot } from '../../model-snapshot.types';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands owned entities (P0-06) into the model snapshot:
 *
 * - `TableSplit` — flattens the owned columns into the owner table (prefixed).
 * - `Json` — adds a single canonical `JSONB` column on the owner table.
 * - `SeparateTable` — emits a dedicated owned table with FK→owner PK columns.
 */
export class OwnedEntityExpander
  implements EntityExpander<ModelTableSnapshot, ModelColumnSnapshot>
{
  public expand(ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>): void {
    for (const owned of ctx.entity.ownedEntities ?? []) {
      this.expandOne(owned, ctx);
    }
  }

  private expandOne(
    owned: OwnedEntityMetadata,
    ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>
  ): void {
    const { entity, entityByType, columns, tables, columnMapper } = ctx;
    const ownedEntityMeta = entityByType.get(owned.ownedType);

    if (owned.strategy === StorageStrategy.TableSplit) {
      const prefix = owned.columnPrefix ?? `${owned.ownerPropertyName}_`;
      const sourceCols: ColumnMetadata[] = ownedEntityMeta?.columns ?? [];
      for (const col of sourceCols) {
        columns.push(columnMapper.toModelColumn(col, { namePrefix: prefix }));
      }
      return;
    }

    if (owned.strategy === StorageStrategy.Json) {
      const jsonCol = owned.jsonColumnName ?? owned.ownerPropertyName;
      // Use JSONB as the canonical abstract type for JSON-strategy columns.
      // Dialects map: Postgres → JSONB, MySQL → JSON, MSSQL → NVARCHAR(MAX).
      columns.push({
        name: jsonCol,
        type: 'JSONB',
        nullable: true,
        isPrimaryKey: false
      });
      return;
    }

    if (owned.strategy === StorageStrategy.SeparateTable) {
      const ownedTableName = ownedEntityMeta?.tableName ?? owned.ownerPropertyName;
      const ownerPrimaryKeys = entity.primaryKeys ?? [];
      const fkColumns: ModelColumnSnapshot[] =
        owned.foreignKeyColumns?.map((fk) => ({
          name: fk,
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: true
        })) ??
        ownerPrimaryKeys.map((pk) => {
          const col = entity.columns.find((c) => c.propertyName === pk);
          return {
            name: `${entity.tableName}_${col?.columnName ?? pk}`,
            type: String(col?.type ?? 'INTEGER').toUpperCase(),
            nullable: false,
            isPrimaryKey: true
          };
        });

      const ownedCols: ModelColumnSnapshot[] = (ownedEntityMeta?.columns ?? []).map((col) =>
        columnMapper.toModelColumn(col)
      );

      // Sorting of columns / primary keys is centralized in the coordinator.
      tables.set(ownedTableName, {
        name: ownedTableName,
        columns: [...fkColumns, ...ownedCols],
        primaryKeys: fkColumns.map((c) => c.name),
        indexes: []
      });
    }
  }
}
