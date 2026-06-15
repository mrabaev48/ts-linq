import type { EntityMetadata, RelationshipMetadata } from '@ts-linq/types';

import { deleteBehaviorToSql } from '../../../builders/handlers/ForeignKeyHandlers';
import type { ForeignKeyDef } from '../../../DiffTypes';

/**
 * Resolves the foreign-key columns owned by an entity from its relationship metadata.
 *
 * Only the dependent side (`many-to-one` / `one-to-one` carrying a `foreignKey`)
 * owns the FK column. Referenced columns resolve to the principal's PK, or to a named
 * alternate key when `hasPrincipalKey()` was used.
 *
 * Extracted from the schema snapshot builder as a focused collaborator; it is not an
 * `EntityExpander` because it returns foreign keys rather than mutating the table map.
 */
export class ForeignKeyResolver {
  public resolve(
    entityMeta: EntityMetadata,
    entityByTarget: ReadonlyMap<Function | string, EntityMetadata>
  ): ForeignKeyDef[] {
    const fks: ForeignKeyDef[] = [];
    for (const rel of entityMeta.relationships ?? []) {
      // Only the dependent side (many-to-one / one-to-one with foreignKey) owns the FK column.
      if (rel.type !== 'many-to-one' && rel.type !== 'one-to-one') continue;
      if (!rel.foreignKey) continue;

      const targetMeta = this.resolveTargetMeta(rel, entityByTarget);
      if (!targetMeta) continue;

      // If hasPrincipalKey() was called, resolve refColumns from the named alternate key.
      let refColumns: string[];
      if (rel.inverseSide) {
        const ak = (targetMeta.alternateKeys ?? []).find((k) =>
          k.columns.includes(rel.inverseSide!)
        );
        if (ak) {
          refColumns = ak.columns.map(
            (col) => targetMeta.columns.find((c) => c.propertyName === col)?.columnName ?? col
          );
        } else {
          // Fall back to PK if the referenced property happens to be a PK column.
          refColumns = [
            targetMeta.columns.find((c) => c.propertyName === rel.inverseSide)?.columnName ??
              rel.inverseSide
          ];
        }
      } else {
        const refPkProps = targetMeta.primaryKeys ?? [];
        if (refPkProps.length === 0) continue;
        refColumns = refPkProps
          .map((pk) => targetMeta.columns.find((c) => c.propertyName === pk)?.columnName ?? pk)
          .filter(Boolean);
      }

      if (refColumns.length === 0) continue;

      const fk: ForeignKeyDef = {
        columns: [rel.foreignKey],
        refTable: targetMeta.tableName,
        refColumns
      };

      if (rel.onDelete) {
        const clause = deleteBehaviorToSql(rel.onDelete);
        if (clause) fk.onDelete = clause;
      }

      fks.push(fk);
    }
    return fks;
  }

  private resolveTargetMeta(
    rel: RelationshipMetadata,
    entityByTarget: ReadonlyMap<Function | string, EntityMetadata>
  ): EntityMetadata | undefined {
    const { targetEntity } = rel;
    if (!targetEntity) return undefined;
    if (typeof targetEntity === 'function') {
      // Could be the class itself or a lazy factory (() => Class).
      const direct = entityByTarget.get(targetEntity);
      if (direct) return direct;
      // Try calling it as a factory.
      try {
        const resolved = (targetEntity as () => Function)();
        if (resolved) return entityByTarget.get(resolved);
      } catch {
        // Not a factory, ignore.
      }
    }
    if (typeof targetEntity === 'string') {
      return entityByTarget.get(targetEntity);
    }
    return undefined;
  }
}
