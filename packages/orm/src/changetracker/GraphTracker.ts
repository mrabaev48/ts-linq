import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';
import type { EntityState } from '@ts-linq/types';

import type { EntityEntryGraphNode, ITrackGraphEntry } from './EntityEntryGraphNode';
import { GraphIterator } from './GraphIterator';

/**
 * Narrow state port the {@link GraphTracker} depends on instead of the full
 * `ChangeTracker`, keeping graph traversal decoupled from the state machine.
 */
export interface GraphStatePort {
  getEntityState(entity: object): EntityState;
  setState(entity: object, entityClass: EntityCtorRef, state: EntityState): void;
}

/**
 * Walks a detached object graph (BFS, cycle-safe) and exposes each node to the
 * caller as an {@link ITrackGraphEntry}. Extracted from `ChangeTracker`
 * (refactor task-4); the node factory builds entries whose `state` read/write is
 * delegated to the injected {@link GraphStatePort}.
 */
export class GraphTracker {
  constructor(
    private readonly registry: MetadataRegistry,
    private readonly state: GraphStatePort
  ) {}

  trackGraph(
    root: object,
    entityClass: EntityCtorRef,
    callback: (node: EntityEntryGraphNode) => void
  ): void {
    const nodeFactory = (
      entity: object,
      cls: EntityCtorRef,
      inboundNavigation: string | undefined
    ): EntityEntryGraphNode => {
      // Capture methods as closures so getters/setters don't need 'this' inside object literal.
      const getState = (): EntityState => this.state.getEntityState(entity);
      const setStateFn = (value: EntityState): void => this.state.setState(entity, cls, value);
      const getIsKeySet = (): boolean => {
        const meta = this.registry.getEntity(cls);
        const pk = meta?.primaryKeys?.[0];
        if (!pk) return false;
        const val = (entity as Record<string, unknown>)[pk];
        return val !== undefined && val !== null && val !== 0 && val !== '';
      };
      const entry: ITrackGraphEntry = {
        entity,
        entityClass: cls,
        get state() {
          return getState();
        },
        set state(value: EntityState) {
          setStateFn(value);
        },
        get isKeySet() {
          return getIsKeySet();
        }
      };
      return { entry, inboundNavigation };
    };
    const iterator = new GraphIterator(this.registry, nodeFactory);
    iterator.traverse(root, entityClass, callback);
  }
}
