import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { createMetadataRegistry } from '@ts-linq/metadata';
import type { TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { TrackedIdentityMap } from '../../src/changetracker/TrackedIdentityMap';

class Single {
  id!: number;
}

// Composite PK with column names deliberately out of alphabetical order.
class Composite {
  tenantId!: number;
  accountId!: number;
}

function buildRegistry() {
  const registry = createMetadataRegistry();

  registry.addEntity(Single, 'singles');
  registry.setFluentPrimaryKeys(Single, ['id']);
  registry.mergeFluentColumn(Single, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });

  registry.addEntity(Composite, 'composites');
  registry.setFluentPrimaryKeys(Composite, ['tenantId', 'accountId']);
  registry.mergeFluentColumn(Composite, {
    propertyName: 'tenantId',
    columnName: 'tenantId',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(Composite, {
    propertyName: 'accountId',
    columnName: 'accountId',
    type: 'int',
    nullable: false
  });

  return registry;
}

function track<T extends object>(entity: T, entityClass: new () => T): TrackedEntity {
  return { entity, entityClass, state: EntityState.Unchanged };
}

describe('TrackedIdentityMap', () => {
  it('registers and finds a single-PK entity by reference and by value', () => {
    const map = new TrackedIdentityMap(buildRegistry());
    const entity = { id: 7 };
    const tracked = track(entity, Single);

    map.register(tracked);

    expect(map.findByPk(entity, Single)).toBe(tracked);
    expect(map.findByValues(Single, [7])).toBe(tracked);
    expect(map.findByValues(Single, [99])).toBeUndefined();
  });

  it('keys composite PKs independent of property enumeration order', () => {
    const map = new TrackedIdentityMap(buildRegistry());
    // Build the entity with the keys in a different order than the PK declaration.
    const entity = { accountId: 5, tenantId: 1 } as Composite;
    const tracked = track(entity, Composite);

    map.register(tracked);

    // A different object with the same composite PK resolves to the same tracked entry.
    const other = { tenantId: 1, accountId: 5 } as Composite;
    expect(map.findByPk(other, Composite)).toBe(tracked);
    // findByValues expects values in alphabetical PK-name order: accountId, tenantId.
    expect(map.findByValues(Composite, [5, 1])).toBe(tracked);
  });

  it('does not index entities whose PK is unset', () => {
    const map = new TrackedIdentityMap(buildRegistry());
    const entity = { id: undefined } as unknown as Single;
    map.register(track(entity, Single));
    expect(map.findByPk(entity, Single)).toBeUndefined();
  });

  it('unregisters and clears', () => {
    const map = new TrackedIdentityMap(buildRegistry());
    const entity = { id: 3 };
    const tracked = track(entity, Single);

    map.register(tracked);
    map.unregister(tracked);
    expect(map.findByPk(entity, Single)).toBeUndefined();

    map.register(tracked);
    map.clear();
    expect(map.findByPk(entity, Single)).toBeUndefined();
  });
});
