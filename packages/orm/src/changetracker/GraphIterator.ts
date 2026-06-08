import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import type { EntityEntryGraphNode } from './EntityEntryGraphNode';

interface QueueItem {
  entity: object;
  entityClass: EntityCtorRef;
  inboundNavigation: string | undefined;
}

/**
 * BFS traversal over an entity object graph, guided by navigation metadata.
 * Cycle-safe via a visited Set<object> keyed on object reference.
 * Does not create EntityEntry instances — the caller provides a factory
 * to avoid circular imports between ChangeTracker and EntityEntry.
 */
export class GraphIterator {
  constructor(
    private readonly registry: MetadataRegistry,
    private readonly nodeFactory: (
      entity: object,
      entityClass: EntityCtorRef,
      inboundNavigation: string | undefined
    ) => EntityEntryGraphNode
  ) {}

  traverse(
    root: object,
    rootEntityClass: EntityCtorRef,
    callback: (node: EntityEntryGraphNode) => void
  ): void {
    const visited = new Set<object>();
    const queue: QueueItem[] = [
      { entity: root, entityClass: rootEntityClass, inboundNavigation: undefined }
    ];

    while (queue.length > 0) {
      const { entity, entityClass, inboundNavigation } = queue.shift()!;
      if (visited.has(entity)) continue;
      visited.add(entity);

      callback(this.nodeFactory(entity, entityClass, inboundNavigation));

      const meta = this.registry.getEntity(entityClass);
      if (!meta) continue;

      const rec = entity as Record<string, unknown>;

      // Walk regular relationships (1:1, 1:N, N:1)
      for (const rel of meta.relationships ?? []) {
        const targetCtor = this.resolveTargetCtor(rel.targetEntity);
        if (!targetCtor) continue;
        const val = rec[rel.propertyName];
        if (Array.isArray(val)) {
          for (const child of val) {
            if (child !== null && child !== undefined && typeof child === 'object') {
              queue.push({
                entity: child as object,
                entityClass: targetCtor,
                inboundNavigation: rel.propertyName
              });
            }
          }
        } else if (val !== null && val !== undefined && typeof val === 'object') {
          queue.push({
            entity: val as object,
            entityClass: targetCtor,
            inboundNavigation: rel.propertyName
          });
        }
      }

      // Walk skip navigations (M:N)
      for (const sn of meta.skipNavigations ?? []) {
        const val = rec[sn.propertyName];
        if (!Array.isArray(val)) continue;
        for (const child of val) {
          if (child !== null && child !== undefined && typeof child === 'object') {
            queue.push({
              entity: child as object,
              entityClass: sn.targetEntity,
              inboundNavigation: sn.propertyName
            });
          }
        }
      }
    }
  }

  private resolveTargetCtor(
    targetEntity: string | EntityCtorRef | (() => EntityCtorRef) | undefined
  ): EntityCtorRef | undefined {
    if (!targetEntity) return undefined;
    if (typeof targetEntity === 'function') {
      try {
        const result = (targetEntity as () => EntityCtorRef)();
        if (typeof result === 'function') return result;
      } catch {
        // Not a thunk — it's a direct constructor
      }
      return targetEntity as EntityCtorRef;
    }
    return undefined;
  }
}
