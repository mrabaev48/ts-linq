import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import type { WhereClause } from '@ts-linq/types';

import { GlobalFilterApplier } from '../src/GlobalFilterApplier';

@Entity({ name: 'gfa_posts' })
class GfaPost {
  @PrimaryKey()
  id!: number;
  @Column({ name: 'is_deleted' })
  isDeleted!: boolean;
  @Column({ name: 'tenant_id' })
  tenantId!: string;
}

describe('GlobalFilterApplier — model-level query filters', () => {
  const applier = new GlobalFilterApplier();

  beforeAll(() => {
    MetadataStorage.getEntity(GfaPost);
  });

  it('applies no filters when entityQueryFilters is undefined', () => {
    const model: { where?: WhereClause[] } = {};
    applier.apply(GfaPost, model, undefined, undefined, undefined, undefined, undefined);
    expect(model.where ?? []).toHaveLength(0);
  });

  it('skips all filters when ignoredFilters is "all"', () => {
    const model: { where?: WhereClause[] } = {};
    const filters = [
      { name: 'softDelete', ast: { type: 'literal', value: false }, parameters: [false] }
    ];
    applier.apply(GfaPost, model, undefined, undefined, 'all', undefined, filters);
    expect(model.where ?? []).toHaveLength(0);
  });

  it('skips named filter when in ignore set', () => {
    const model: { where?: WhereClause[] } = {};
    const filters = [
      {
        name: 'softDelete',
        ast: { type: 'not', operand: { type: 'property', name: 'isDeleted' } },
        parameters: []
      },
      {
        name: 'tenant',
        ast: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'tenantId' },
          right: { type: 'parameterRef', index: 0 }
        },
        parameters: ['x']
      }
    ];
    // Skip softDelete — tenant runs
    applier.apply(
      GfaPost,
      model,
      undefined,
      undefined,
      new Set(['softDelete']),
      undefined,
      filters
    );
    // tenant filter produces 1 WHERE condition
    expect(model.where!).toHaveLength(1);
  });
});
