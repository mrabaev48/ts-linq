import type { EntityCtor } from '@ts-linq/types';
import type {
  CheckConstraintMetadata,
  EntityStoredProcedureMapping,
  OwnedEntityMetadata,
  QueryFilterMetadata,
  RelationshipMetadata,
  ValidationRule
} from '@ts-linq/types';

import { AdvancedMappingStore } from '../../src/registry/AdvancedMappingStore';
import { ConstraintStore } from '../../src/registry/ConstraintStore';
import { EntityMetadataState } from '../../src/registry/EntityMetadataState';
import { RelationshipStore } from '../../src/registry/RelationshipStore';
import { StoredProcedureStore } from '../../src/registry/StoredProcedureStore';
import { TableConfigStore } from '../../src/registry/TableConfigStore';

class Foo {}
class Bar {}

function finalize(state: EntityMetadataState, target: EntityCtor, tableName: string): void {
  state.getOrCreateBuilder(target).setTableName(tableName);
  state.finalizeEntity(target);
}

describe('RelationshipStore', () => {
  const rel = (propertyName: string): RelationshipMetadata => ({
    propertyName,
    type: 'many-to-one',
    targetEntity: 'Bar'
  });

  it('appends relationships and merges fluent overrides by property name', () => {
    const state = new EntityMetadataState();
    const store = new RelationshipStore(state);
    finalize(state, Foo, 'foo');

    store.addRelationship(Foo, rel('bar'));
    store.mergeFluentRelationship(Foo, { ...rel('bar'), nullable: true });

    const rels = state.getFinalized(Foo)?.relationships;
    expect(rels).toHaveLength(1);
    expect(rels?.[0].nullable).toBe(true);
  });
});

describe('ConstraintStore', () => {
  it('appends validation rules and replaces check constraints', () => {
    const state = new EntityMetadataState();
    const store = new ConstraintStore(state);
    finalize(state, Foo, 'foo');

    const rule: ValidationRule = { propertyName: 'id', message: 'required' };
    store.addValidationRule(Foo, rule);
    const checks: CheckConstraintMetadata[] = [{ name: 'ck_pos', sql: 'id > 0' }];
    store.setCheckConstraints(Foo, checks);

    expect(state.getFinalized(Foo)?.validations).toEqual([rule]);
    expect(state.getFinalized(Foo)?.checkConstraints).toEqual(checks);
  });
});

describe('TableConfigStore', () => {
  it('applies table-level scalar config to a finalized entity', () => {
    const state = new EntityMetadataState();
    const store = new TableConfigStore(state);
    finalize(state, Foo, 'foo');

    store.registerEntity(Foo, 'renamed');
    store.mergeFluentSchema(Foo, 'sales');
    store.setFluentKeyless(Foo, true);
    store.setFluentViewName(Foo, 'v_foo');

    const meta = state.getFinalized(Foo);
    expect(meta?.tableName).toBe('renamed');
    expect(meta?.schema).toBe('sales');
    expect(meta?.isKeyless).toBe(true);
    expect(meta?.viewName).toBe('v_foo');
  });

  it('registerEntity on a fresh target creates a pending builder', () => {
    const state = new EntityMetadataState();
    const store = new TableConfigStore(state);

    store.registerEntity(Foo, 'foo');

    expect(state.hasBuilder(Foo)).toBe(true);
  });
});

describe('AdvancedMappingStore', () => {
  it('appends owned entities and upserts query filters by name', () => {
    const state = new EntityMetadataState();
    const store = new AdvancedMappingStore(state);
    finalize(state, Foo, 'foo');

    // Shape is opaque to the store (it only appends), so a minimal stub suffices here.
    store.addOwnedEntity(Foo, { ownedType: Bar } as unknown as OwnedEntityMetadata);

    const filterV1: QueryFilterMetadata = { name: 'soft', ast: {}, parameters: [] };
    const filterV2: QueryFilterMetadata = { name: 'soft', ast: { v: 2 }, parameters: [] };
    store.mergeFluentQueryFilter(Foo, filterV1);
    store.mergeFluentQueryFilter(Foo, filterV2);

    expect(state.getFinalized(Foo)?.ownedEntities).toHaveLength(1);
    expect(state.getFinalized(Foo)?.queryFilters).toEqual([filterV2]);
  });

  it('records the hierarchy root on a finalized subtype', () => {
    const state = new EntityMetadataState();
    const store = new AdvancedMappingStore(state);
    finalize(state, Bar, 'bar');

    store.setHierarchyRoot(Bar, Foo);

    expect(state.getFinalized(Bar)?.hierarchyRoot).toBe(Foo);
  });
});

describe('StoredProcedureStore', () => {
  it('stores and retrieves SP mappings, bypassing the builder lifecycle', () => {
    const state = new EntityMetadataState();
    const store = new StoredProcedureStore(state);
    const mapping: EntityStoredProcedureMapping = {
      insert: { procedureName: 'sp_foo_insert', parameters: [], rowsAffectedMode: 'none' }
    };

    store.setStoredProcedureMapping(Foo, mapping);

    // No builder/finalized entry is created for SP-only registration.
    expect(state.hasBuilder(Foo)).toBe(false);
    expect(store.getStoredProcedureMapping(Foo)).toBe(mapping);
  });

  it('clear() drops all mappings', () => {
    const state = new EntityMetadataState();
    const store = new StoredProcedureStore(state);
    store.setStoredProcedureMapping(Foo, {});

    store.clear();

    expect(store.getStoredProcedureMapping(Foo)).toBeUndefined();
  });
});
