/**
 * Unit tests for DbContextOptionsBuilder.useQuerySplittingBehavior() — P1-18.
 */
import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { QuerySplittingBehavior } from '@ts-linq/types';

import { DbContextOptionsBuilder } from '../src/DbContextOptionsBuilder';
import { TestProvider } from '../tests/stubs/TestProvider';

describe('DbContextOptionsBuilder.useQuerySplittingBehavior()', () => {
  it('sets querySplittingBehavior in built options', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider })
      .useQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
      .build();
    expect(opts.querySplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('sets SingleQuery mode in built options', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider })
      .useQuerySplittingBehavior(QuerySplittingBehavior.SingleQuery)
      .build();
    expect(opts.querySplittingBehavior).toBe(QuerySplittingBehavior.SingleQuery);
  });

  it('does not set querySplittingBehavior when useQuerySplittingBehavior is not called', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider }).build();
    expect(opts.querySplittingBehavior).toBeUndefined();
  });

  it('preserves base options querySplittingBehavior when builder does not override it', () => {
    const provider = new TestProvider(':memory:');
    const base = { provider, querySplittingBehavior: QuerySplittingBehavior.SplitQuery };
    const opts = new DbContextOptionsBuilder(base).build();
    expect(opts.querySplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('builder override takes precedence over base options querySplittingBehavior', () => {
    const provider = new TestProvider(':memory:');
    const base = { provider, querySplittingBehavior: QuerySplittingBehavior.SingleQuery };
    const opts = new DbContextOptionsBuilder(base)
      .useQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
      .build();
    expect(opts.querySplittingBehavior).toBe(QuerySplittingBehavior.SplitQuery);
  });

  it('returns this for fluent chaining', () => {
    const provider = new TestProvider(':memory:');
    const builder = new DbContextOptionsBuilder({ provider });
    const result = builder.useQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    expect(result).toBe(builder);
  });

  it('exports QuerySplittingBehavior from DbContextOptionsBuilder module', () => {
    // Verify that users can import QuerySplittingBehavior from @ts-linq/orm directly
    const { QuerySplittingBehavior: QSB } = require('../src/DbContextOptionsBuilder');
    expect(QSB.SplitQuery).toBe('SplitQuery');
    expect(QSB.SingleQuery).toBe('SingleQuery');
  });
});
