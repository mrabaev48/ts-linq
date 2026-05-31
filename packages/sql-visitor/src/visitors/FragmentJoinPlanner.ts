import type { EntityMetadata, JoinClause } from '@ts-linq/types';

/**
 * Produces the INNER JOIN clauses required to auto-join all table fragments of an entity
 * during SELECT queries (entity splitting, P1-25).
 *
 * For an entity with `tableFragments = [{ tableName: "OrdersDetails", properties: [...] }]`
 * the planner emits:
 *   INNER JOIN "OrdersDetails" ON "OrdersDetails"."<pk>" = "<primaryTable>"."<pk>"
 */
export class FragmentJoinPlanner {
  /**
   * Returns the JOIN clauses needed to include all secondary table fragments.
   * Returns an empty array when the entity has no fragments (normal single-table case).
   */
  plan(meta: EntityMetadata): JoinClause[] {
    const fragments = meta.tableFragments;
    if (!fragments || fragments.length === 0) return [];

    const primaryTable = meta.tableName;
    const pkProps = meta.primaryKeys ?? [];
    if (pkProps.length === 0) return [];

    const pkColumns = pkProps.map(
      (prop) => meta.columns.find((c) => c.propertyName === prop)?.columnName ?? prop
    );

    return fragments.map((fragment): JoinClause => {
      const onParts = pkColumns.map(
        (col) => `"${fragment.tableName}"."${col}" = "${primaryTable}"."${col}"`
      );
      return {
        type: 'INNER',
        table: fragment.tableName,
        on: onParts.join(' AND ')
      };
    });
  }
}
