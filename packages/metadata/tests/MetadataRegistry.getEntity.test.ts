import 'reflect-metadata';

import type { ColumnMetadata } from '@ts-linq/types';
import { MetadataError, OrmError, ValidationError } from '@ts-linq/types';

import { MetadataRegistry } from '../src/MetadataRegistry';

// Helper: add a minimal entity with one PK column to the given registry.
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

// Reflect helper that lets us simulate a *no-reflect-metadata* environment by
// removing the capability probe's backing function for the duration of `fn`.
function withoutReflectMetadata<T>(fn: () => T): T {
  const reflectHolder = Reflect as unknown as {
    getOwnMetadata?: (key: string, target: Function) => unknown;
  };
  const saved = reflectHolder.getOwnMetadata;
  delete reflectHolder.getOwnMetadata;
  try {
    return fn();
  } finally {
    if (saved) reflectHolder.getOwnMetadata = saved;
  }
}

describe('MetadataRegistry.getEntity — capability probe + typed error path', () => {
  // ─── Guard clause ───────────────────────────────────────────────────────────

  describe('invalid targets', () => {
    it('returns undefined for non-function / falsy targets', () => {
      const registry = new MetadataRegistry();
      expect(registry.getEntity(undefined as unknown as Function)).toBeUndefined();
      expect(registry.getEntity({} as unknown as Function)).toBeUndefined();
    });

    it('returns undefined for an unregistered entity', () => {
      class Unknown {}
      expect(new MetadataRegistry().getEntity(Unknown)).toBeUndefined();
    });
  });

  // ─── Target rebasing (wrapper via reflect-metadata) ──────────────────────────

  describe('target rebasing for a wrapped decorator target', () => {
    it('resolves a wrapper to its original and rebases `target` onto the wrapper', () => {
      class Original {}
      class Wrapper {}
      // Decorators may register against `Original` while runtime queries arrive
      // for the `Wrapper`; the `orm:original` reflection links the two.
      Reflect.defineMetadata('orm:original', Original, Wrapper);

      const registry = new MetadataRegistry();
      seedEntity(registry, Original, 'originals');

      const viaOriginal = registry.getEntity(Original);
      const viaWrapper = registry.getEntity(Wrapper);

      expect(viaOriginal).toBeDefined();
      expect(viaWrapper).toBeDefined();

      // Same metadata shape — only the `target` differs (rebased to the wrapper).
      expect(viaOriginal!.target).toBe(Original);
      expect(viaWrapper!.target).toBe(Wrapper);
      expect({ ...viaWrapper!, target: undefined }).toEqual({
        ...viaOriginal!,
        target: undefined
      });
      expect(viaWrapper!.tableName).toBe('originals');
    });
  });

  // ─── Capability: no reflect-metadata present ─────────────────────────────────

  describe('no-reflect-metadata environment', () => {
    it('still resolves metadata via the raw target when the probe returns undefined', () => {
      class Plain {}
      const registry = new MetadataRegistry();
      seedEntity(registry, Plain, 'plains');

      const withReflect = registry.getEntity(Plain);

      const withoutReflect = withoutReflectMetadata(() => registry.getEntity(Plain));

      expect(withoutReflect).toBeDefined();
      expect(withoutReflect).toEqual(withReflect);
      expect(withoutReflect!.tableName).toBe('plains');
      expect(withoutReflect!.target).toBe(Plain);
    });
  });

  // ─── Error path: unexpected failure surfaces typed (no silent fallback) ──────

  describe('unexpected resolution failure', () => {
    it('wraps a non-OrmError thrown during resolution in a typed MetadataError with cause', () => {
      const boom = new Error('boom');

      class ThrowingRegistry extends MetadataRegistry {
        protected override resolveOriginal(): Function {
          throw boom;
        }
      }

      const registry = new ThrowingRegistry();
      class Foo {}
      seedEntity(registry, Foo, 'foos');

      let caught: unknown;
      try {
        registry.getEntity(Foo);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(MetadataError);
      expect(caught).toBeInstanceOf(OrmError);
      expect((caught as MetadataError).code).toBe('METADATA_ERROR');
      expect((caught as MetadataError).cause).toBe(boom);
    });

    it('propagates an already-typed OrmError unchanged (no double-wrapping)', () => {
      const typed = new ValidationError('already typed');

      class TypedThrowingRegistry extends MetadataRegistry {
        protected override resolveOriginal(): Function {
          throw typed;
        }
      }

      const registry = new TypedThrowingRegistry();
      class Bar {}
      seedEntity(registry, Bar, 'bars');

      expect(() => registry.getEntity(Bar)).toThrow(typed);
    });
  });
});
