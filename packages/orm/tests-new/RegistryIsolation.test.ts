import 'reflect-metadata';

import { beforeEach, describe, expect, it } from '@jest/globals';
import { EntityState } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';
import { createMetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRegistry(
  ...entities: Array<{ target: Function; tableName: string }>
): MetadataRegistry {
  const registry = createMetadataRegistry();
  for (const { target, tableName } of entities) {
    registry.addEntity(target, tableName);
    registry.addColumn(target, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true,
      isVersion: false
    } satisfies ColumnMetadata);
    registry.addPrimaryKey(target, 'id');
  }
  return registry;
}

// ── Entity stubs (defined once at module level — no decorator side-effects) ───

class TenantAUser {
  id!: number;
  name!: string;
}

class TenantBProduct {
  id!: number;
  sku!: string;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegistryIsolation — DbContext-style registry option', () => {
  beforeEach(() => {
    // Reset the singleton so programmatic registrations in tests start clean.
    // Module-level class definitions above are NOT affected (they have no
    // decorator side-effects and are not registered in the singleton).
    MetadataStorage.reset();
  });

  describe('ChangeTracker with an isolated registry', () => {
    it('resolves entity metadata from the supplied registry, not the singleton', () => {
      // Singleton knows nothing about TenantAUser
      expect(MetadataStorage.getEntity(TenantAUser)).toBeUndefined();

      const registry = makeRegistry({ target: TenantAUser, tableName: 'users_t1' });
      const tracker = new ChangeTracker(registry);

      const user = Object.assign(new TenantAUser(), { id: 1, name: 'Alice' });
      tracker.add(user, TenantAUser);

      expect(tracker.getEntityState(user)).toBe(EntityState.Added);
    });

    it('two trackers with separate registries have independent underlying registries', () => {
      const registryA = makeRegistry({ target: TenantAUser, tableName: 'users_a' });
      const registryB = makeRegistry({ target: TenantBProduct, tableName: 'products_b' });

      const trackerA = new ChangeTracker(registryA);
      const trackerB = new ChangeTracker(registryB);

      const user = Object.assign(new TenantAUser(), { id: 1, name: 'Alice' });
      const product = Object.assign(new TenantBProduct(), { id: 42, sku: 'SKU-001' });

      trackerA.add(user, TenantAUser);
      trackerB.add(product, TenantBProduct);

      // Each tracker correctly tracks what was added to it
      expect(trackerA.getEntityState(user)).toBe(EntityState.Added);
      expect(trackerB.getEntityState(product)).toBe(EntityState.Added);

      // Registry isolation: registryA sees TenantAUser, registryB sees TenantBProduct
      expect(registryA.getEntity(TenantAUser)).toBeDefined();
      expect(registryA.getEntity(TenantBProduct)).toBeUndefined();

      expect(registryB.getEntity(TenantBProduct)).toBeDefined();
      expect(registryB.getEntity(TenantAUser)).toBeUndefined();

      // Neither tracker's pending changes include the other tracker's entities
      const changesA = trackerA.getChanges();
      const changesB = trackerB.getChanges();
      expect(changesA.every((c) => c.entity !== product)).toBe(true);
      expect(changesB.every((c) => c.entity !== user)).toBe(true);
    });

    it('clearing one registry does not affect the other', () => {
      const registryA = makeRegistry({ target: TenantAUser, tableName: 'users_a' });
      const registryB = makeRegistry({ target: TenantBProduct, tableName: 'products_b' });

      registryA.clear();

      expect(registryA.getEntities()).toHaveLength(0);
      expect(registryB.getEntities()).toHaveLength(1);
    });
  });

  describe('Singleton vs isolated-registry isolation', () => {
    it('entities registered in the singleton are invisible to an isolated registry', () => {
      class GlobalEntity {}
      MetadataStorage.addEntity(GlobalEntity, 'global');

      const isolated = createMetadataRegistry();

      expect(MetadataStorage.getEntity(GlobalEntity)).toBeDefined();
      expect(isolated.getEntity(GlobalEntity)).toBeUndefined();
    });

    it('a ChangeTracker using an isolated registry ignores singleton entities', () => {
      class SomeEntity {}
      MetadataStorage.addEntity(SomeEntity, 'some_entities');

      const isolated = createMetadataRegistry();
      // isolated has no entities — it does not mirror the singleton
      expect(isolated.getEntities()).toHaveLength(0);

      // A tracker backed by the isolated registry also sees nothing
      const tracker = new ChangeTracker(isolated);
      expect(tracker.getChanges()).toHaveLength(0);
    });
  });
});
