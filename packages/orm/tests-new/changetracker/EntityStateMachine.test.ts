import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { createMetadataRegistry } from '@ts-linq/metadata';
import type { TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { EntityStateMachine } from '../../src/changetracker/EntityStateMachine';
import type { ITrackedEntityObserver } from '../../src/changetracker/ITrackedEntityObserver';
import { SkipNavigationTracker } from '../../src/changetracker/SkipNavigationTracker';
import { SnapshotStore } from '../../src/changetracker/SnapshotStore';
import { TrackedIdentityMap } from '../../src/changetracker/TrackedIdentityMap';
import type { LocalViewChangeType } from '../../src/LocalView';

class Item {
  id!: number;
  label!: string;
}

function buildRegistry() {
  const registry = createMetadataRegistry();
  registry.addEntity(Item, 'items');
  registry.setFluentPrimaryKeys(Item, ['id']);
  registry.mergeFluentColumn(Item, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(Item, {
    propertyName: 'label',
    columnName: 'label',
    type: 'string',
    nullable: false
  });
  return registry;
}

class RecordingObserver implements ITrackedEntityObserver {
  readonly events: Array<{ type: LocalViewChangeType; state: EntityState }> = [];
  syncCount = 0;
  onTracked(tracked: TrackedEntity, changeType: LocalViewChangeType): void {
    this.events.push({ type: changeType, state: tracked.state });
  }
  onSync(): void {
    this.syncCount++;
  }
}

function makeMachine() {
  const registry = buildRegistry();
  const observer = new RecordingObserver();
  const machine = new EntityStateMachine(
    new TrackedIdentityMap(registry),
    new SnapshotStore(registry),
    new SkipNavigationTracker(registry),
    observer
  );
  return { machine, observer };
}

describe('EntityStateMachine', () => {
  it('add tracks Added and emits an "added" event', () => {
    const { machine, observer } = makeMachine();
    const item: Item = { id: 1, label: 'x' };
    machine.add(item, Item);

    expect(machine.getEntityState(item)).toBe(EntityState.Added);
    expect(observer.events).toEqual([{ type: 'added', state: EntityState.Added }]);
  });

  it('attach is Identity-Map keyed: a second object with the same PK reuses the entry', () => {
    const { machine } = makeMachine();
    const first: Item = { id: 1, label: 'a' };
    machine.attach(first, Item);
    const second: Item = { id: 1, label: 'b' };
    machine.attach(second, Item);

    // Only the first reference is tracked; the second resolves onto it.
    expect(machine.getTrackedForType(Item)).toHaveLength(1);
    expect(machine.getTrackedForType(Item)[0].entity).toBe(first);
  });

  it('getChanges returns only non-Unchanged entries', () => {
    const { machine } = makeMachine();
    const added: Item = { id: 1, label: 'a' };
    const unchangedItem: Item = { id: 2, label: 'b' };
    machine.add(added, Item);
    machine.attach(unchangedItem, Item);

    const changes = machine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].entity).toBe(added);
  });

  it('acceptAllChanges resets non-deleted to Unchanged, purges deleted, and re-syncs', () => {
    const { machine, observer } = makeMachine();
    const kept: Item = { id: 1, label: 'a' };
    const gone: Item = { id: 2, label: 'b' };
    machine.update(kept, Item);
    machine.attach(gone, Item);
    machine.remove(gone, Item);

    const syncBefore = observer.syncCount;
    machine.acceptAllChanges();

    expect(machine.getEntityState(kept)).toBe(EntityState.Unchanged);
    expect(machine.getTrackedForType(Item).map((t) => t.entity)).toEqual([kept]);
    expect(observer.syncCount).toBe(syncBefore + 1);
  });

  it('setState emits "removed" for Deleted and "modified" otherwise', () => {
    const { machine, observer } = makeMachine();
    const item: Item = { id: 1, label: 'a' };
    machine.attach(item, Item);
    observer.events.length = 0;

    const last = () => observer.events[observer.events.length - 1];

    machine.setState(item, Item, EntityState.Deleted);
    expect(last()).toEqual({ type: 'removed', state: EntityState.Deleted });

    machine.setState(item, Item, EntityState.Modified);
    expect(last()).toEqual({ type: 'modified', state: EntityState.Modified });
  });

  it('clear empties tracking and re-syncs', () => {
    const { machine, observer } = makeMachine();
    machine.add({ id: 1, label: 'a' }, Item);
    machine.clear();

    expect(machine.getTrackedForType(Item)).toHaveLength(0);
    expect(observer.syncCount).toBeGreaterThan(0);
  });
});
