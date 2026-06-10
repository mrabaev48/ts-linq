import 'reflect-metadata';

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import { SqlVisitor } from '@ts-linq/sql-visitor';
import { QueryFilterCompilationError, type WhereClause } from '@ts-linq/types';

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
  // The applier no longer constructs its own visitor — callers inject a configured one (task-4).
  const visitor = new SqlVisitor();

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
      filters,
      visitor
    );
    // tenant filter produces 1 WHERE condition
    expect(model.where!).toHaveLength(1);
  });

  it('fails closed: throws (does not silently drop) when a filter cannot be compiled', () => {
    const model: { where?: WhereClause[] } = {};
    const compileFailure = new Error('unsupported AST node');
    // A visitor whose toSql throws simulates a security-relevant filter that fails to compile.
    const throwingVisitor = {
      toSql: () => {
        throw compileFailure;
      }
    } as unknown as SqlVisitor;
    const filters = [
      {
        name: 'tenant',
        ast: { type: 'property', name: 'tenantId' },
        parameters: []
      }
    ];

    let thrown: unknown;
    try {
      applier.apply(
        GfaPost,
        model,
        undefined,
        undefined,
        undefined,
        undefined,
        filters,
        throwingVisitor
      );
    } catch (e) {
      thrown = e;
    }

    // Fail-closed: the failure surfaces instead of producing an under-filtered query.
    expect(thrown).toBeInstanceOf(QueryFilterCompilationError);
    expect((thrown as QueryFilterCompilationError).cause).toBe(compileFailure);
    expect((thrown as QueryFilterCompilationError).details).toEqual({ filterName: 'tenant' });
    // The dangerous filter was NOT silently appended-and-skipped: no half-applied state leaks.
    expect(model.where ?? []).toHaveLength(0);
  });
});
