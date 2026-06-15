import type { EntityMetadata, TableFragmentMetadata } from '@ts-linq/types';

import type { ColumnDef, TableSnapshot } from '../../../DiffTypes';
import type { ColumnMapper } from '../ColumnMapper';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands entity (table) splitting fragments — secondary tables that hold a subset
 * of an entity's properties plus the shared primary-key columns. Each fragment is
 * emitted as an additional {@link TableSnapshot}, merging into an existing entry when
 * another entity already claimed the fragment table name.
 */
export class TableFragmentExpander implements EntityExpander<TableSnapshot, ColumnDef> {
  public expand(ctx: ExpansionContext<TableSnapshot, ColumnDef>): void {
    const { entity, tables, columnMapper } = ctx;
    const fragments = entity.tableFragments ?? [];
    if (fragments.length === 0) return;

    const primaryKeyProps = entity.primaryKeys ?? [];
    const primaryKeys = primaryKeyProps.map(
      (pk) => entity.columns.find((column) => column.propertyName === pk)?.columnName || pk
    );

    for (const fragment of fragments) {
      this.expandFragment(entity, fragment, primaryKeys, tables, columnMapper);
    }
  }

  private expandFragment(
    entity: EntityMetadata,
    fragment: TableFragmentMetadata,
    primaryKeys: string[],
    tables: Map<string, TableSnapshot>,
    columnMapper: ColumnMapper
  ): void {
    const primaryKeyProps = entity.primaryKeys ?? [];
    const fragmentPropSet = new Set<string>(fragment.properties ?? []);

    // Fragment table contains PK columns + its own properties.
    const fragmentColumns: ColumnDef[] = entity.columns
      .filter(
        (col) => primaryKeyProps.includes(col.propertyName) || fragmentPropSet.has(col.propertyName)
      )
      .map((column) =>
        columnMapper.toSchemaColumn(column, {
          isPrimaryKey: primaryKeyProps.includes(column.propertyName)
        })
      );

    if (fragmentColumns.length === 0) return;

    const existing = tables.get(fragment.tableName);
    if (existing) {
      for (const col of fragmentColumns) {
        if (!existing.columns.some((c) => c.name === col.name)) {
          existing.columns.push(col);
        }
      }
    } else {
      tables.set(fragment.tableName, {
        name: fragment.tableName,
        columns: fragmentColumns,
        primaryKeys,
        indexes: [],
        foreignKeys: []
      });
    }
  }
}
