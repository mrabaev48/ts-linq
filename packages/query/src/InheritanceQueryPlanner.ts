import { MetadataStorage } from '@ts-linq/metadata';
import { InheritanceStrategy, type SqlParameter } from '@ts-linq/types';

import type { QueryModel } from './QueryModel';

/**
 * Strategy for `ofType<TSub>()`: mutates the subtype query model with the clauses that narrow a
 * polymorphic query to a concrete subtype.
 *
 * - **TPH** — adds a WHERE on the discriminator column (quoted via the dialect).
 * - **TPT** — adds an INNER JOIN to the subtype table on the shared PK (structured `onColumns`).
 * - **TPC** — repoints the FROM to the concrete leaf table.
 *
 * Stateless and SQL-free: identifier quoting is delegated through the injected `quoteIdentifier`
 * (refactor query/task-6). Shared by reference across clones.
 */
export class InheritanceQueryPlanner {
  /**
   * Apply the inheritance-strategy clauses for `subtypeCtor` onto `model` in place. No-ops when the
   * entity is not part of a configured hierarchy.
   */
  plan(
    subtypeCtor: new () => unknown,
    model: QueryModel,
    quoteIdentifier: (identifier: string) => string
  ): void {
    const subtypeMeta = MetadataStorage.getEntity(subtypeCtor);
    if (!subtypeMeta?.hierarchyRoot) return;

    const rootMeta = MetadataStorage.getEntity(
      subtypeMeta.hierarchyRoot as unknown as new () => unknown
    );
    if (!rootMeta?.hierarchy) return;

    const { strategy, discriminator } = rootMeta.hierarchy;

    if (strategy === InheritanceStrategy.Tph) {
      const entry = discriminator?.entries.find((e) => e.ctor === subtypeCtor);
      if (entry && discriminator) {
        // Quote the discriminator column through the dialect — no hardcoded ANSI `"`.
        const quotedDiscriminator = quoteIdentifier(discriminator.columnName);
        model.where = model.where ?? [];
        model.where.push({
          condition: `${quotedDiscriminator} = ?`,
          parameters: [entry.value as SqlParameter]
        });
      }
    } else if (strategy === InheritanceStrategy.Tpt) {
      const pk = rootMeta.primaryKeys?.[0] ?? 'id';
      const baseTable = rootMeta.tableName;
      const subTable = subtypeMeta.tableName;
      model.joins = model.joins ?? [];
      // Emit a structured equi-join on the shared PK; the dialect renders + quotes it.
      model.joins.push({
        type: 'INNER',
        table: subTable,
        onColumns: [
          {
            left: { table: baseTable, column: pk },
            right: { table: subTable, column: pk }
          }
        ]
      });
    } else if (strategy === InheritanceStrategy.Tpc) {
      model.from = subtypeMeta.tableName;
    }
  }
}
