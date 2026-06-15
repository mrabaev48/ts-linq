import type { ModelColumnSnapshot, ModelTableSnapshot } from '../../model-snapshot.types';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands many-to-many skip navigations (P0-08) into synthesized join tables.
 *
 * Only synthesized join tables are emitted (an explicit join entity is snapshotted
 * as a normal table). Deduplication is by table name: the same join table referenced
 * from both navigation sides is emitted once.
 */
export class SkipNavigationExpander
  implements EntityExpander<ModelTableSnapshot, ModelColumnSnapshot>
{
  public expand(ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>): void {
    const { entity, tables } = ctx;

    for (const sn of entity.skipNavigations ?? []) {
      if (!sn.isSynthesized) continue;
      if (tables.has(sn.joinTableName)) continue;

      const columns: ModelColumnSnapshot[] = [
        { name: sn.leftForeignKey, type: 'INT', nullable: false, isPrimaryKey: true },
        { name: sn.rightForeignKey, type: 'INT', nullable: false, isPrimaryKey: true }
      ];

      tables.set(sn.joinTableName, {
        name: sn.joinTableName,
        columns,
        primaryKeys: [sn.leftForeignKey, sn.rightForeignKey],
        indexes: []
      });
    }
  }
}
