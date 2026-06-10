import type { RelationshipMetadata } from '@ts-linq/types';

import { ManyToManyStrategy } from './ManyToManyStrategy';
import { OneToManyStrategy } from './OneToManyStrategy';
import type { RelationshipLoadStrategy } from './RelationshipLoadStrategy';
import { ToOneStrategy } from './ToOneStrategy';

type RelationshipKind = RelationshipMetadata['type'];

const toOne = new ToOneStrategy();
const oneToMany = new OneToManyStrategy();
const manyToMany = new ManyToManyStrategy();

/**
 * Dispatch map keyed by `relationship.type`, replacing the per-kind
 * `if (type === 'one-to-many')` / `switch (relationship.type)` chains that were
 * duplicated across `EntityLoader` and `RelationshipLoader`. The strategies are
 * stateless — all per-call state flows through the `RelationshipLoadContext` —
 * so a single shared instance per kind is reused by both loaders.
 */
export const relationshipStrategyRegistry: ReadonlyMap<RelationshipKind, RelationshipLoadStrategy> =
  new Map<RelationshipKind, RelationshipLoadStrategy>([
    ['one-to-one', toOne],
    ['many-to-one', toOne],
    ['one-to-many', oneToMany],
    ['many-to-many', manyToMany]
  ]);

/** Resolve the load strategy for a relationship kind, or `undefined` if unknown. */
export function strategyFor(kind: RelationshipKind): RelationshipLoadStrategy | undefined {
  return relationshipStrategyRegistry.get(kind);
}
