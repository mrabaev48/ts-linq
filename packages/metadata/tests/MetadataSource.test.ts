import type {
  ColumnMetadata,
  EntityMetadata,
  EntityStoredProcedureMapping,
  MetadataSink,
  MetadataSource,
  OwnedEntityMetadata,
  ValidationRule
} from '@ts-linq/types';

import { createMetadataRegistry } from '../src/index';
import { MetadataRegistry } from '../src/MetadataRegistry';
import { MetadataStorage } from '../src/MetadataStorage';

// Helper: add a minimal entity with one column to the given registry.
function seedEntity(sink: MetadataSink, target: Function, tableName: string): void {
  sink.addEntity(target, tableName);
  sink.addColumn(target, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true,
    isVersion: false
  } satisfies ColumnMetadata);
  sink.addPrimaryKey(target, 'id');
}

describe('MetadataSource / MetadataSink ports', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  // ─── Type-level: MetadataRegistry satisfies both ports ──────────────────────
  //
  // ts-jest type-checks these files, so the assignments below fail compilation
  // (and thus the test run) if MetadataRegistry ever stops implementing the
  // ports or a port signature drifts from the registry surface.

  describe('type-level conformance', () => {
    it('MetadataRegistry is assignable to MetadataSource and MetadataSink', () => {
      const registry = new MetadataRegistry();
      const asSource: MetadataSource = registry;
      const asSink: MetadataSink = registry;

      // `satisfies` proves the concrete class structurally implements both ports.
      const both = registry satisfies MetadataSource satisfies MetadataSink;

      expect(asSource).toBe(registry);
      expect(asSink).toBe(registry);
      expect(both).toBe(registry);
    });

    it('the default singleton is a MetadataSource', () => {
      const source: MetadataSource = MetadataStorage.getInstance();
      expect(source).toBeInstanceOf(MetadataRegistry);
    });
  });

  // ─── Unit: identical behaviour when accessed through the read port ──────────

  describe('MetadataRegistry read behaviour through the MetadataSource port', () => {
    it('getEntity / getEntities return the same result via the port and the class', () => {
      class User {}
      const registry = createMetadataRegistry();
      seedEntity(registry, User, 'users');

      const source: MetadataSource = registry;

      expect(source.getEntity(User)).toBe(registry.getEntity(User));
      expect(source.getEntities()).toEqual(registry.getEntities());
      expect(source.getEntity(User)?.tableName).toBe('users');
    });

    it('getValidationRules / getOwnedEntities / getStoredProcedureMapping match the class', () => {
      class Order {}
      const registry = createMetadataRegistry();
      seedEntity(registry, Order, 'orders');

      const rule: ValidationRule = {
        propertyName: 'id',
        message: 'id is required'
      };
      registry.addValidationRule(Order, rule);

      const mapping: EntityStoredProcedureMapping = {
        insert: { procedureName: 'sp_order_insert', parameters: [], rowsAffectedMode: 'none' }
      };
      registry.setStoredProcedureMapping(Order, mapping);

      const source: MetadataSource = registry;

      expect(source.getValidationRules(Order)).toEqual(registry.getValidationRules(Order));
      expect(source.getValidationRules(Order)).toContainEqual(rule);
      expect(source.getOwnedEntities(Order)).toEqual(registry.getOwnedEntities(Order));
      expect(source.getStoredProcedureMapping(Order)).toBe(mapping);
    });

    it('returns undefined / empty for unknown entities through the port', () => {
      class Unknown {}
      const source: MetadataSource = createMetadataRegistry();

      expect(source.getEntity(Unknown)).toBeUndefined();
      expect(source.getEntities()).toHaveLength(0);
      expect(source.getValidationRules(Unknown)).toEqual([]);
      expect(source.getOwnedEntities(Unknown)).toEqual([]);
      expect(source.getStoredProcedureMapping(Unknown)).toBeUndefined();
    });
  });

  // ─── Contract: a fake MetadataSource substitutes the registry ───────────────
  //
  // Mirrors how the core loading layer (core/task-2) will consume the port:
  // depend on the MetadataSource abstraction, never on the concrete registry.

  describe('a fake MetadataSource substitutes the registry in consumer-style code', () => {
    // A consumer that depends only on the read port.
    function resolveTableName(source: MetadataSource, target: Function): string | undefined {
      return source.getEntity(target)?.tableName;
    }

    class Product {}

    class FakeMetadataSource implements MetadataSource {
      private readonly entities = new Map<Function, EntityMetadata>();

      public define(target: Function, meta: EntityMetadata): void {
        this.entities.set(target, meta);
      }

      public getEntity(target: Function): EntityMetadata | undefined {
        return this.entities.get(target);
      }
      public getEntities(): EntityMetadata[] {
        return [...this.entities.values()];
      }
      public getValidationRules(target: Function): ValidationRule[] {
        return this.entities.get(target)?.validations ?? [];
      }
      public getOwnedEntities(owner: Function): OwnedEntityMetadata[] {
        return this.entities.get(owner)?.ownedEntities ?? [];
      }
      public getStoredProcedureMapping(): EntityStoredProcedureMapping | undefined {
        return undefined;
      }
    }

    it('produces the same consumer result with the real registry and a fake', () => {
      const registry = createMetadataRegistry();
      seedEntity(registry, Product, 'products');

      const fake = new FakeMetadataSource();
      fake.define(Product, {
        tableName: 'products',
        columns: [],
        primaryKeys: ['id'],
        relationships: [],
        indexes: []
      });

      expect(resolveTableName(registry, Product)).toBe('products');
      expect(resolveTableName(fake, Product)).toBe('products');
      expect(resolveTableName(registry, Product)).toBe(resolveTableName(fake, Product));
    });
  });

  // ─── Regression: decorator-style static registration is unchanged ───────────

  describe('MetadataStorage static API still drives the default source', () => {
    it('static addEntity is visible through getInstance() as a MetadataSource', () => {
      class Invoice {}
      MetadataStorage.addEntity(Invoice, 'invoices');

      const source: MetadataSource = MetadataStorage.getInstance();
      expect(source.getEntity(Invoice)?.tableName).toBe('invoices');
      expect(MetadataStorage.getEntity(Invoice)).toBe(source.getEntity(Invoice));
    });
  });
});
