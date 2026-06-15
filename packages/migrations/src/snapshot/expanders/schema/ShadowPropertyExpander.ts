import type { ColumnDef, TableSnapshot } from '../../../DiffTypes';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands shadow properties (P1-16) — properties that exist only in the model — into
 * regular DDL columns appended to the entity's primary-table column list.
 */
export class ShadowPropertyExpander implements EntityExpander<TableSnapshot, ColumnDef> {
  public expand(ctx: ExpansionContext<TableSnapshot, ColumnDef>): void {
    const shadowProperties = ctx.entity.shadowProperties;
    if (!shadowProperties) return;

    for (const sp of shadowProperties.values()) {
      ctx.columns.push(ctx.columnMapper.toSchemaShadowColumn(sp));
    }
  }
}
