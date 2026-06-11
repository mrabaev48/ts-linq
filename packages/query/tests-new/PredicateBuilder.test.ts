/**
 * Unit tests for {@link PredicateBuilder} — the where/having clause builder + SQL-visitor/column
 * plumbing extracted from `Queryable` (refactor query/task-1).
 */
import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import { PredicateBuilder } from '../src/PredicateBuilder';
import type { QueryBuilder } from '../src/QueryBuilder';
import { QueryModel } from '../src/QueryModel';
import type { SqlVisitorFactory } from '../src/SqlVisitorFactory';

class PbUser {
  id!: number;
  status!: string;
}

class PbOther {
  id!: number;
}

beforeAll(() => {
  MetadataStorage.addEntity(PbUser, 'pb_users');
  MetadataStorage.addColumn(PbUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addColumn(PbUser, {
    propertyName: 'status',
    columnName: 'status_code',
    type: 'TEXT'
  });
  MetadataStorage.addEntity(PbOther, 'pb_others');
});

const provider = {
  getDialect: () => ({ quoteIdentifier: (id: string) => `"${id}"` })
} as unknown as DatabaseProvider;

/** Visitor factory whose visitor echoes a fixed compiled predicate. */
const visitorFactory = {
  create: () => ({
    toSql: () => ({ condition: '"status_code" = ?', parameters: ['active'] })
  })
} as unknown as SqlVisitorFactory;

/** SQL builder that renders a subquery with provider-numbered placeholders ($1). */
function makeSubBuilder(): QueryBuilder {
  return {
    generateFromModel: () => ({ query: 'SELECT id FROM pb_others WHERE x = $1', parameters: ['v'] })
  } as unknown as QueryBuilder;
}

function builder(): PredicateBuilder<PbUser> {
  return new PredicateBuilder<PbUser>(PbUser, provider, visitorFactory);
}

describe('PredicateBuilder column resolution', () => {
  it('resolveColumnName maps property → column, falling back to the property name', () => {
    expect(builder().resolveColumnName('status')).toBe('status_code');
    expect(builder().resolveColumnName('unknown')).toBe('unknown');
  });

  it('buildColumnResolver resolves a named property node', () => {
    const resolver = builder().buildColumnResolver();
    expect(resolver).toBeDefined();
    expect(resolver!({ name: 'status' } as never)).toBe('status_code');
  });

  it('buildConverterResolver returns undefined when no converter is registered', () => {
    expect(builder().buildConverterResolver()).toBeUndefined();
  });
});

describe('PredicateBuilder.whereIn', () => {
  it('compiles an empty value list to 1 = 0', () => {
    expect(builder().whereIn('status', [])).toEqual({
      clause: { condition: '1 = 0', parameters: [] },
      signature: '|1=0:[]'
    });
  });

  it('quotes the resolved column and binds each value', () => {
    const built = builder().whereIn('status', ['a', 'b']);
    expect(built.clause.condition).toBe('"status_code" IN (?, ?)');
    expect(built.clause.parameters).toEqual(['a', 'b']);
    expect(built.signature).toBe('|statusIN:["a","b"]');
  });

  it('summarizes the signature for large value lists', () => {
    const built = builder().whereIn('status', [1, 2, 3, 4, 5, 6]);
    expect(built.signature).toBe('|statusIN:[6 values]');
  });
});

describe('PredicateBuilder subquery predicates', () => {
  it('whereExists wraps the subquery and normalizes placeholders to ?', () => {
    const built = builder().whereExists(makeSubBuilder(), new QueryModel(), PbOther);
    expect(built.clause.condition).toBe('EXISTS (SELECT id FROM pb_others WHERE x = ?)');
    expect(built.clause.parameters).toEqual(['v']);
    expect(built.signature).toContain('EXISTS (');
  });

  it('whereInSubquery resolves+quotes the column and normalizes placeholders', () => {
    const built = builder().whereInSubquery('status', makeSubBuilder(), new QueryModel(), PbOther);
    expect(built.clause.condition).toBe('"status_code" IN (SELECT id FROM pb_others WHERE x = ?)');
  });
});

describe('PredicateBuilder.whereCompiled / compileHaving', () => {
  it('whereCompiled builds a clause from the visitor output with a signature', () => {
    const built = builder().whereCompiled({ ast: {} as never, parameters: [] });
    expect(built.clause).toEqual({ condition: '"status_code" = ?', parameters: ['active'] });
    expect(built.signature).toBe('|"status_code" = ?:["active"]');
  });

  it('compileHaving returns the compiled expression without a signature', () => {
    const having = builder().compileHaving({ ast: {} as never, parameters: [] });
    expect(having).toEqual({ condition: '"status_code" = ?', parameters: ['active'] });
  });
});
