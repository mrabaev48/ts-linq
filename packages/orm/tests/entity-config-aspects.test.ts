import 'reflect-metadata';

import type { MetadataRegistry } from '@ts-linq/metadata';
import { createMetadataRegistry, PropertyAccessMode } from '@ts-linq/metadata';
import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';
import { InheritanceStrategy } from '@ts-linq/types';

import { ColumnAspect } from '../src/builders/aspects/ColumnAspect';
import type { AspectApplyContext } from '../src/builders/aspects/EntityConfigAspect';
import { IndexAndConstraintAspect } from '../src/builders/aspects/IndexAndConstraintAspect';
import { InheritanceAspect } from '../src/builders/aspects/InheritanceAspect';
import { KeyAndTableAspect } from '../src/builders/aspects/KeyAndTableAspect';
import { MiscMetadataAspect } from '../src/builders/aspects/MiscMetadataAspect';
import { OwnedAndComplexAspect } from '../src/builders/aspects/OwnedAndComplexAspect';
import { QueryFilterAspect } from '../src/builders/aspects/QueryFilterAspect';
import { RelationshipAspect } from '../src/builders/aspects/RelationshipAspect';
import { SkipNavigationAspect } from '../src/builders/aspects/SkipNavigationAspect';
import { StoredProcedureAspect } from '../src/builders/aspects/StoredProcedureAspect';
import { TableSplittingAspect } from '../src/builders/aspects/TableSplittingAspect';
import type { CollectionCollectionBuilder } from '../src/builders/CollectionCollectionBuilder';
import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

class Foo {
  id!: number;
  tenantId!: string;
  name!: string;
  address?: { city: string };
}
class Bar {}

/** Registers Foo so non-key aspects (which merge into an existing record) can apply. */
function freshRegistry(): MetadataRegistry {
  const registry = createMetadataRegistry();
  registry.addEntity(Foo, 'foos');
  return registry;
}

/** A minimal skip-nav builder stub that records the leftPk it is applied with. */
function captureSkipNav(sink: string[]): CollectionCollectionBuilder<Foo, object> {
  return {
    _applyToRegistry: (_r: MetadataRegistry, leftPk: string): void => {
      sink.push(leftPk);
    }
  } as unknown as CollectionCollectionBuilder<Foo, object>;
}

describe('EntityConfigAspect — per-aspect applyTo', () => {
  it('KeyAndTableAspect writes table/schema/keys and publishes ctx.primaryKeys', () => {
    const registry = createMetadataRegistry();
    const aspect = new KeyAndTableAspect<Foo>();
    aspect.toTable('foos', 'sales');
    aspect.hasKey(['id']);

    const ctx: AspectApplyContext = {};
    aspect.applyTo(registry, Foo, ctx);

    const meta = registry.getEntity(Foo);
    expect(meta?.tableName).toBe('foos');
    expect(meta?.schema).toBe('sales');
    expect(meta?.primaryKeys).toEqual(['id']);
    expect(ctx.primaryKeys).toEqual(['id']);
  });

  it('ColumnAspect merges columns (with entity access mode) and shadow properties', () => {
    const registry = freshRegistry();
    const aspect = new ColumnAspect<Foo>();
    const col: ColumnMetadata = {
      propertyName: 'name',
      columnName: 'name',
      type: 'text',
      nullable: false
    };
    aspect.columns.set('name', col);
    aspect.shadowColumns.set('createdAt', {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'datetime',
      nullable: false
    });
    aspect.usePropertyAccessMode(PropertyAccessMode.Field);

    aspect.applyTo(registry, Foo);

    const meta = registry.getEntity(Foo);
    expect(meta?.columns.find((c) => c.propertyName === 'name')?.accessMode).toBe(
      PropertyAccessMode.Field
    );
    expect(meta?.shadowProperties?.has('createdAt')).toBe(true);
  });

  it('RelationshipAspect merges accumulated relationships', () => {
    const registry = freshRegistry();
    const aspect = new RelationshipAspect<Foo>(Foo);
    const rel: RelationshipMetadata = {
      propertyName: 'bar',
      type: 'many-to-one',
      targetEntity: Bar
    };
    aspect.relationships.push(rel);

    aspect.applyTo(registry, Foo);

    expect(
      registry.getEntity(Foo)?.relationships.find((r) => r.propertyName === 'bar')
    ).toBeDefined();
  });

  it('IndexAndConstraintAspect writes indexes, alternate keys and check constraints', () => {
    const registry = freshRegistry();
    const aspect = new IndexAndConstraintAspect<Foo>(Foo);
    const idx: IndexMetadata = { name: 'IX_foo_name', columns: ['name'] };
    aspect.indexes.push(idx);
    aspect.hasAlternateKey((f) => f.tenantId);
    aspect.hasCheckConstraint('CK_foo_name', "name <> ''");

    aspect.applyTo(registry, Foo);

    const meta = registry.getEntity(Foo);
    expect(meta?.indexes.find((i) => i.name === 'IX_foo_name')).toBeDefined();
    expect(meta?.alternateKeys).toHaveLength(1);
    expect(meta?.alternateKeys?.[0].columns).toEqual(['tenantId']);
    expect(meta?.checkConstraints).toHaveLength(1);
    expect(meta?.checkConstraints?.[0].name).toBe('CK_foo_name');
  });

  it('InheritanceAspect writes the selected hierarchy strategy', () => {
    const registry = freshRegistry();
    const aspect = new InheritanceAspect<Foo>();
    aspect.useTpt();

    aspect.applyTo(registry, Foo);

    expect(registry.getEntity(Foo)?.hierarchy?.strategy).toBe(InheritanceStrategy.Tpt);
  });

  it('OwnedAndComplexAspect writes complex properties', () => {
    const registry = freshRegistry();
    const aspect = new OwnedAndComplexAspect<Foo>(Foo);
    aspect.complexProperty((f) => f.address);

    aspect.applyTo(registry, Foo);

    expect(registry.getEntity(Foo)?.complexProperties).toHaveLength(1);
  });

  it('TableSplittingAspect writes table fragments', () => {
    const registry = freshRegistry();
    const aspect = new TableSplittingAspect<Foo>();
    aspect.splitToTable('foo_details', (s) => s.property((f) => f.name));

    aspect.applyTo(registry, Foo);

    expect(registry.getEntity(Foo)?.tableFragments).toHaveLength(1);
    expect(registry.getEntity(Foo)?.tableFragments?.[0].tableName).toBe('foo_details');
  });

  it('StoredProcedureAspect writes the sproc mapping', () => {
    const registry = freshRegistry();
    const aspect = new StoredProcedureAspect<Foo>();
    aspect.insertUsingStoredProcedure('sp_foo_insert');

    aspect.applyTo(registry, Foo);

    expect(registry.getStoredProcedureMapping(Foo)?.insert).toBeDefined();
  });

  it('MiscMetadataAspect writes temporal/comment/keyless/view/seed metadata', () => {
    const registry = freshRegistry();
    const aspect = new MiscMetadataAspect<Foo>();
    aspect.isTemporal();
    aspect.withHistoryTable('foo_history');
    aspect.hasComment('the foos');
    aspect.hasNoKey();
    aspect.toView('v_foo');
    aspect.hasViewSql('SELECT 1');
    aspect.hasData([{ id: 1 }]);

    aspect.applyTo(registry, Foo);

    const meta = registry.getEntity(Foo);
    expect(meta?.isTemporal).toBe(true);
    expect(meta?.historyTableName).toBe('foo_history');
    expect(meta?.comment).toBe('the foos');
    expect(meta?.isKeyless).toBe(true);
    expect(meta?.viewName).toBe('v_foo');
    expect(meta?.viewSql).toBe('SELECT 1');
    expect(meta?.seedData).toHaveLength(1);
  });

  it('QueryFilterAspect.applyTo is a no-op; filters are read back via getQueryFilters', () => {
    const registry = freshRegistry();
    const aspect = new QueryFilterAspect<Foo>();
    aspect.hasQueryFilterCompiled({ ast: { kind: 'stub' }, parameters: [] });

    aspect.applyTo();

    expect(aspect.getQueryFilters()).toHaveLength(1);
    // No query-filter surface leaks into the registry snapshot.
    expect(registry.getEntity(Foo)).toBeDefined();
  });
});

describe('EntityConfigAspect — apply-order contract (skip-nav depends on keys)', () => {
  it('SkipNavigationAspect derives leftPk from ctx.primaryKeys published by KeyAndTableAspect', () => {
    const registry = createMetadataRegistry();
    const key = new KeyAndTableAspect<Foo>();
    key.hasKey(['tenantId', 'id']);
    const skip = new SkipNavigationAspect<Foo>();
    const captured: string[] = [];
    skip.skipNavBuilders.push(captureSkipNav(captured));

    const ctx: AspectApplyContext = {};
    key.applyTo(registry, Foo, ctx); // publishes ctx.primaryKeys
    skip.applyTo(registry, Foo, ctx); // consumes ctx.primaryKeys

    expect(ctx.primaryKeys).toEqual(['tenantId', 'id']);
    expect(captured).toEqual(['tenantId']);
  });

  it('SkipNavigationAspect falls back to "id" when no key aspect published primaryKeys', () => {
    const registry = createMetadataRegistry();
    const skip = new SkipNavigationAspect<Foo>();
    const captured: string[] = [];
    skip.skipNavBuilders.push(captureSkipNav(captured));

    skip.applyTo(registry, Foo, {});

    expect(captured).toEqual(['id']);
  });

  it('EntityTypeBuilder._applyToRegistry applies KeyAndTableAspect before SkipNavigationAspect', () => {
    const keySpy = jest.spyOn(KeyAndTableAspect.prototype, 'applyTo');
    const skipSpy = jest.spyOn(SkipNavigationAspect.prototype, 'applyTo');
    try {
      const builder = new EntityTypeBuilder(Foo);
      builder.hasKey('id');
      builder._applyToRegistry(createMetadataRegistry());

      expect(keySpy).toHaveBeenCalled();
      expect(skipSpy).toHaveBeenCalled();
      expect(keySpy.mock.invocationCallOrder[0]).toBeLessThan(skipSpy.mock.invocationCallOrder[0]);
    } finally {
      keySpy.mockRestore();
      skipSpy.mockRestore();
    }
  });
});
