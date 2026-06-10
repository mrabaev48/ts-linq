import type { EntityRef, RelationshipMetadata } from '@ts-linq/types';

/**
 * Junction-table mapping for a many-to-many relationship, normalized from the
 * loose `RelationshipMetadata.through` (`string | object | undefined`).
 */
export interface ThroughMapping {
  readonly table: string;
  readonly sourceFk?: string;
  readonly targetFk?: string;
}

/**
 * A typed, narrowed view over {@link RelationshipMetadata} for the loading
 * layer. It guarantees the two invariants the loaders rely on but the raw
 * metadata type does not express:
 *
 * - `targetEntity` is a resolvable {@link EntityRef} (never `string`/`undefined`).
 * - `through` is a structured {@link ThroughMapping} (or absent).
 *
 * This replaces the `as unknown as { … }` relationship casts that previously
 * hid the real contract from the compiler (task-7 cast removal overlap).
 */
export interface LoadableRelationship {
  readonly propertyName: string;
  readonly type: RelationshipMetadata['type'];
  readonly foreignKey?: string;
  readonly targetEntity: EntityRef;
  readonly through?: ThroughMapping;
}

function normalizeThrough(through: RelationshipMetadata['through']): ThroughMapping | undefined {
  if (
    through &&
    typeof through === 'object' &&
    typeof (through as ThroughMapping).table === 'string'
  ) {
    const t = through as ThroughMapping;
    return { table: t.table, sourceFk: t.sourceFk, targetFk: t.targetFk };
  }
  return undefined;
}

/**
 * Project a raw {@link RelationshipMetadata} into a {@link LoadableRelationship},
 * or `null` when the relationship has no resolvable target (a `string` or
 * absent `targetEntity`) and therefore cannot be loaded.
 */
export function asLoadable(relationship: RelationshipMetadata): LoadableRelationship | null {
  const target = relationship.targetEntity;
  if (target == null || typeof target === 'string') return null;
  return {
    propertyName: relationship.propertyName,
    type: relationship.type,
    foreignKey: relationship.foreignKey,
    targetEntity: target,
    through: normalizeThrough(relationship.through)
  };
}
