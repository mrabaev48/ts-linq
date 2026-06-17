import { describe, expect, it } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { Queryable } from '@ts-linq/query';

import { ChangeTracker } from '../src/ChangeTracker';
import {
  QUERYABLE_NON_OPERATORS,
  queryableOperatorNames
} from '../src/context/queryableForwarding';
import { DbSet } from '../src/DbSet';

@Entity({ name: 'parity_users' })
class User {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  name!: string;
}

function makeDbSet(): DbSet<User> {
  const changeTracker = new ChangeTracker();
  const mockProvider = {
    providerLabel: 'MockProvider',
    loggerRef: undefined,
    getDialect: () => ({ parameterStyle: 0, quoteIdentifier: (s: string) => `"${s}"` })
  } as any as DatabaseProvider;
  return new DbSet(User, { provider: mockProvider, changeTracker });
}

/**
 * Contract guard for orm/task-3: `DbSet<T>` must surface the *entire* `Queryable<T>` chain operator
 * set with zero hand-forwarding. The single source of truth is `Queryable.prototype` (filtered by
 * {@link queryableOperatorNames}); this test fails the moment a new operator is added to
 * `@ts-linq/query` but cannot be reached from a `DbSet` — replacing the former "developer
 * discipline" parity with a compiler/test-enforced one.
 */
describe('DbSet ↔ Queryable parity', () => {
  it('reaches every Queryable chain operator from a DbSet instance', () => {
    const dbSet = makeDbSet() as unknown as Record<string, unknown>;
    const operators = queryableOperatorNames();

    // Sanity: the surface is genuinely large (catches an accidentally-empty operator list).
    expect(operators.length).toBeGreaterThan(40);

    const missing = operators.filter((op) => typeof dbSet[op] !== 'function');
    expect(missing).toEqual([]);
  });

  it('surfaces representative operators from every category', () => {
    const dbSet = makeDbSet() as unknown as Record<string, unknown>;
    const representative = [
      'where',
      'whereCompiled',
      'select',
      'selectCompiled',
      'orderBy',
      'take',
      'skip',
      'groupBy',
      'having',
      'havingCompiled',
      'distinct',
      'include',
      'union',
      'innerJoinOn',
      'withCte',
      'asNoTracking',
      'asSplitQuery',
      'ofType',
      'ignoreQueryFilters',
      'tagWith',
      'temporalAsOf',
      'executeUpdate',
      'executeDelete',
      'toArray',
      'toListAsync',
      'first',
      'count',
      'sum',
      'paginate',
      'keysetPaginate'
    ];
    for (const op of representative) {
      expect(typeof dbSet[op]).toBe('function');
    }
  });

  it('forwards a mid-chain operator to a fresh Queryable (delegation, not re-implementation)', () => {
    const dbSet = makeDbSet();
    const q = dbSet.take(5);
    expect(q).toBeInstanceOf(Queryable);
    // Distinct from the seed: the operator returns a new (immutable) Queryable instance.
    expect(q).not.toBe(dbSet._seed());
  });

  it('keeps internal helpers and mid-chain-only members off the surface', () => {
    const operators = queryableOperatorNames();
    // `thenInclude` requires a preceding `include()` — meaningless as a chain start from a set.
    expect(QUERYABLE_NON_OPERATORS.has('thenInclude')).toBe(true);
    expect(operators).not.toContain('thenInclude');
    for (const internal of ['clone', 'withModel', 'applyPredicate', '_withRawSqlSource']) {
      expect(operators).not.toContain(internal);
    }
  });
});
