import type { ColumnMetadata } from '@ts-linq/types';

import { createMetadataRegistry } from '../src/index';
import { MetadataRegistry } from '../src/MetadataRegistry';
import { MetadataStorage } from '../src/MetadataStorage';

// Helper: add a minimal entity with one column to the given registry
function seedEntity(registry: MetadataRegistry, target: Function, tableName: string): void {
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

describe('MetadataStorage isolation', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  // ─── reset() lifecycle ──────────────────────────────────────────────────────

  describe('reset() provides a clean slate for programmatic registration', () => {
    it('entities registered before reset are invisible afterwards', () => {
      class Order {}
      MetadataStorage.addEntity(Order, 'orders');
      expect(MetadataStorage.getEntity(Order)).toBeDefined();

      MetadataStorage.reset();

      expect(MetadataStorage.getEntity(Order)).toBeUndefined();
      expect(MetadataStorage.getEntities()).toHaveLength(0);
    });

    it('consecutive resets each produce an independent empty registry', () => {
      class A {}
      MetadataStorage.addEntity(A, 'a');
      MetadataStorage.reset();

      class B {}
      MetadataStorage.addEntity(B, 'b');
      MetadataStorage.reset();

      expect(MetadataStorage.getEntities()).toHaveLength(0);
    });
  });

  // ─── setDefaultRegistry() ───────────────────────────────────────────────────

  describe('setDefaultRegistry() swaps the active registry', () => {
    it('subsequent static calls operate on the supplied registry', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');

      const fresh = new MetadataRegistry();
      MetadataStorage.setDefaultRegistry(fresh);

      expect(MetadataStorage.getEntities()).toHaveLength(0);
      expect(MetadataStorage.getInstance()).toBe(fresh);
    });

    it('restoring an earlier registry makes its entities visible again', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');
      const original = MetadataStorage.getInstance();

      MetadataStorage.setDefaultRegistry(new MetadataRegistry());
      expect(MetadataStorage.getEntities()).toHaveLength(0);

      MetadataStorage.setDefaultRegistry(original);
      expect(MetadataStorage.getEntities()).toHaveLength(1);
    });
  });

  // ─── createMetadataRegistry() ───────────────────────────────────────────────

  describe('createMetadataRegistry() factory', () => {
    it('returns a new MetadataRegistry instance', () => {
      const registry = createMetadataRegistry();
      expect(registry).toBeInstanceOf(MetadataRegistry);
    });

    it('each call returns a distinct instance', () => {
      const r1 = createMetadataRegistry();
      const r2 = createMetadataRegistry();
      expect(r1).not.toBe(r2);
    });

    it('new instance is empty and independent of the singleton', () => {
      class GlobalEntity {}
      MetadataStorage.addEntity(GlobalEntity, 'global');

      const isolated = createMetadataRegistry();
      expect(isolated.getEntities()).toHaveLength(0);
      expect(isolated.getEntity(GlobalEntity)).toBeUndefined();
    });
  });

  // ─── Multi-tenant: two independent registries ───────────────────────────────

  describe('two independent MetadataRegistry instances (multi-tenant)', () => {
    it('entity A in registry1 is invisible to registry2', () => {
      class TenantA {}
      class TenantB {}

      const registry1 = createMetadataRegistry();
      const registry2 = createMetadataRegistry();

      seedEntity(registry1, TenantA, 'tenant_a');
      seedEntity(registry2, TenantB, 'tenant_b');

      expect(registry1.getEntity(TenantA)).toBeDefined();
      expect(registry1.getEntity(TenantB)).toBeUndefined();

      expect(registry2.getEntity(TenantB)).toBeDefined();
      expect(registry2.getEntity(TenantA)).toBeUndefined();
    });

    it('getEntities() on each registry returns only its own set', () => {
      class Alpha {}
      class Beta {}
      class Gamma {}

      const r1 = createMetadataRegistry();
      const r2 = createMetadataRegistry();

      seedEntity(r1, Alpha, 'alpha');
      seedEntity(r1, Beta, 'beta');
      seedEntity(r2, Gamma, 'gamma');

      expect(r1.getEntities()).toHaveLength(2);
      expect(r2.getEntities()).toHaveLength(1);

      const r1Names = r1.getEntities().map((e) => e.tableName);
      expect(r1Names).toContain('alpha');
      expect(r1Names).toContain('beta');
      expect(r1Names).not.toContain('gamma');
    });

    it('mutations to one registry do not affect the other', () => {
      class Shared {}

      const r1 = createMetadataRegistry();
      const r2 = createMetadataRegistry();

      seedEntity(r1, Shared, 'shared_r1');
      // r2 has no knowledge of Shared

      r1.clear();

      expect(r1.getEntities()).toHaveLength(0);
      // r2 is unaffected — still has nothing (was never seeded)
      expect(r2.getEntities()).toHaveLength(0);
    });
  });

  // ─── DbContext-style isolation via registry option ───────────────────────────
  //
  // DbContext passes `options.registry ?? MetadataStorage.getInstance()` to all
  // internal collaborators.  The ChangeTracker (in @ts-linq/orm) mirrors this
  // pattern directly and accepts an optional registry, making it a lightweight
  // proxy for testing DbContext-level isolation without spinning up a full context.
  //
  // That test lives in packages/orm/tests-new/RegistryIsolation.test.ts so it
  // can import @ts-linq/orm without creating a circular package dependency.
  //
  // The tests below focus on the MetadataRegistry contract in isolation.

  describe('DbContextOptions.registry isolation semantics', () => {
    it('a context-scoped registry does not inherit singleton entities', () => {
      class GlobalOrder {}
      MetadataStorage.addEntity(GlobalOrder, 'orders');

      // Simulate what DbContext does with a custom registry option
      const contextRegistry = createMetadataRegistry();
      // The custom registry is empty — it does NOT mirror the singleton
      expect(contextRegistry.getEntity(GlobalOrder)).toBeUndefined();
      expect(contextRegistry.getEntities()).toHaveLength(0);
    });

    it('two context-scoped registries maintain independent entity sets', () => {
      class TenantUser {}
      class TenantProduct {}

      const ctx1Registry = createMetadataRegistry();
      const ctx2Registry = createMetadataRegistry();

      seedEntity(ctx1Registry, TenantUser, 'users_t1');
      seedEntity(ctx2Registry, TenantProduct, 'products_t2');

      // ctx1 sees TenantUser, not TenantProduct
      expect(ctx1Registry.getEntity(TenantUser)).toBeDefined();
      expect(ctx1Registry.getEntity(TenantProduct)).toBeUndefined();

      // ctx2 sees TenantProduct, not TenantUser
      expect(ctx2Registry.getEntity(TenantProduct)).toBeDefined();
      expect(ctx2Registry.getEntity(TenantUser)).toBeUndefined();
    });
  });
});
