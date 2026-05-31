import { describe, expect, it } from '@jest/globals';
import type { EfFunctionNode, PropertyNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

import { mssqlEfFunctions } from '../../dialect-mssql/src/functions/index';
import { mysqlEfFunctions } from '../../dialect-mysql/src/functions/index';
import { postgresEfFunctions } from '../../dialect-postgres/src/functions/index';
import { ParameterState, ParameterStyle } from '../src/ParameterStyle';
import { SqlVisitor } from '../src/SqlVisitor';
import { EfFunctionVisitor } from '../src/visitors/EfFunctionVisitor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prop = (name: string): PropertyNode => ({ type: 'property', name });

function efNode(fn: string, ...args: EfFunctionNode['args']): EfFunctionNode {
  return { type: 'efFunction', fn, args };
}

// ─── PostgreSQL ────────────────────────────────────────────────────────────────

describe('EfFunctionVisitor — PostgreSQL', () => {
  let visitor: EfFunctionVisitor;

  beforeEach(() => {
    visitor = new EfFunctionVisitor(postgresEfFunctions);
  });

  it('like — column LIKE ?', () => {
    const node = efNode('like', prop('title'), { type: 'literal', value: '%urgent%' });
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('title LIKE ?');
    expect(result.parameters).toEqual(['%urgent%']);
  });

  it('iLike — column ILIKE ?', () => {
    const node = efNode('iLike', prop('title'), { type: 'literal', value: '%urgent%' });
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('title ILIKE ?');
    expect(result.parameters).toEqual(['%urgent%']);
  });

  it('random — RANDOM()', () => {
    const node = efNode('random');
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('RANDOM()');
    expect(result.parameters).toEqual([]);
  });

  it('dateDiffDay — date arithmetic', () => {
    const node = efNode('dateDiffDay', prop('createdAt'), { type: 'parameterRef', index: 0 });
    const result = visitor.visit(node, [new Date('2024-01-01')]);
    expect(result.condition).toBe('(createdAt::date - ?::date)');
    expect(result.parameters).toHaveLength(1);
  });

  it('dateDiffMonth — AGE extraction', () => {
    const node = efNode('dateDiffMonth', prop('createdAt'), { type: 'parameterRef', index: 0 });
    const result = visitor.visit(node, [new Date('2024-01-01')]);
    expect(result.condition).toContain('AGE(createdAt,');
    expect(result.parameters).toHaveLength(1);
  });

  it('greatest — GREATEST(...)', () => {
    const node = efNode('greatest', prop('a'), prop('b'), { type: 'literal', value: 100 });
    const result = visitor.visit(node, []);
    expect(result.condition).toContain('GREATEST(');
    expect(result.condition).toContain('a');
    expect(result.condition).toContain('b');
  });

  it('least — LEAST(...)', () => {
    const node = efNode('least', prop('x'), prop('y'));
    const result = visitor.visit(node, []);
    expect(result.condition).toContain('LEAST(');
  });

  it('stDev — STDDEV()', () => {
    const node = efNode('stDev', prop('score'));
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('STDDEV(score)');
    expect(result.parameters).toEqual([]);
  });

  it('variance — VARIANCE()', () => {
    const node = efNode('variance', prop('score'));
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('VARIANCE(score)');
    expect(result.parameters).toEqual([]);
  });

  it('with parameterRef resolves from inputParameters', () => {
    const node = efNode('like', prop('name'), { type: 'parameterRef', index: 0 });
    const result = visitor.visit(node, ['%john%']);
    expect(result.condition).toBe('name LIKE ?');
    expect(result.parameters).toEqual(['%john%']);
  });

  it('positional parameters ($1, $2)', () => {
    const state = new ParameterState(ParameterStyle.Positional);
    const node = efNode('like', prop('title'), { type: 'literal', value: '%test%' });
    const result = visitor.visit(node, [], undefined, state);
    expect(result.condition).toBe('title LIKE $1');
  });
});

// ─── MySQL ─────────────────────────────────────────────────────────────────────

describe('EfFunctionVisitor — MySQL', () => {
  let visitor: EfFunctionVisitor;

  beforeEach(() => {
    visitor = new EfFunctionVisitor(mysqlEfFunctions);
  });

  it('like — column LIKE ?', () => {
    const node = efNode('like', prop('title'), { type: 'literal', value: '%test%' });
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('title LIKE ?');
  });

  it('random — RAND()', () => {
    expect(visitor.visit(efNode('random'), []).condition).toBe('RAND()');
  });

  it('dateDiffDay — DATEDIFF()', () => {
    const node = efNode('dateDiffDay', prop('createdAt'), { type: 'parameterRef', index: 0 });
    const result = visitor.visit(node, [new Date()]);
    expect(result.condition).toContain('DATEDIFF(');
  });

  it('dateDiffMonth — TIMESTAMPDIFF()', () => {
    const node = efNode('dateDiffMonth', prop('createdAt'), { type: 'parameterRef', index: 0 });
    const result = visitor.visit(node, [new Date()]);
    expect(result.condition).toContain('TIMESTAMPDIFF(MONTH,');
  });

  it('iLike throws UNSUPPORTED_FUNCTION on MySQL', () => {
    const node = efNode('iLike', prop('title'), { type: 'literal', value: '%test%' });
    expect(() => visitor.visit(node, [])).toThrow(AstSqlGenerationError);
    expect(() => visitor.visit(node, [])).toThrow('iLike');
  });

  it('stDev — STDDEV()', () => {
    expect(visitor.visit(efNode('stDev', prop('val')), []).condition).toBe('STDDEV(val)');
  });

  it('variance — VARIANCE()', () => {
    expect(visitor.visit(efNode('variance', prop('val')), []).condition).toBe('VARIANCE(val)');
  });
});

// ─── MSSQL ─────────────────────────────────────────────────────────────────────

describe('EfFunctionVisitor — MSSQL', () => {
  let visitor: EfFunctionVisitor;

  beforeEach(() => {
    visitor = new EfFunctionVisitor(mssqlEfFunctions);
  });

  it('like — column LIKE ?', () => {
    const node = efNode('like', prop('name'), { type: 'literal', value: '%test%' });
    expect(visitor.visit(node, []).condition).toBe('name LIKE ?');
  });

  it('random — ABS(CHECKSUM(NEWID()))', () => {
    expect(visitor.visit(efNode('random'), []).condition).toBe('ABS(CHECKSUM(NEWID()))');
  });

  it('dateDiffDay — DATEDIFF(DAY, ...)', () => {
    const node = efNode('dateDiffDay', prop('createdAt'), { type: 'parameterRef', index: 0 });
    expect(visitor.visit(node, [new Date()]).condition).toContain('DATEDIFF(DAY,');
  });

  it('greatest — SELECT MAX from VALUES', () => {
    const node = efNode('greatest', prop('a'), prop('b'));
    expect(visitor.visit(node, []).condition).toContain('SELECT MAX(v)');
  });

  it('least — SELECT MIN from VALUES', () => {
    const node = efNode('least', prop('a'), prop('b'));
    expect(visitor.visit(node, []).condition).toContain('SELECT MIN(v)');
  });

  it('stDev — STDEV()', () => {
    expect(visitor.visit(efNode('stDev', prop('val')), []).condition).toBe('STDEV(val)');
  });

  it('variance — VAR()', () => {
    expect(visitor.visit(efNode('variance', prop('val')), []).condition).toBe('VAR(val)');
  });

  it('iLike throws on MSSQL', () => {
    const node = efNode('iLike', prop('name'), { type: 'literal', value: '%test%' });
    expect(() => visitor.visit(node, [])).toThrow(AstSqlGenerationError);
  });
});

// ─── User-defined functions ───────────────────────────────────────────────────

describe('EfFunctionVisitor — user-defined functions', () => {
  it('resolves user function via userFunctions map', () => {
    const userFunctions = new Map([['jsonExtract', 'jsonb_extract_path_text']]);
    const visitor = new EfFunctionVisitor(postgresEfFunctions, userFunctions);
    const node = efNode('jsonExtract', prop('data'), { type: 'literal', value: 'key' });
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('jsonb_extract_path_text(data, ?)');
    expect(result.parameters).toEqual(['key']);
  });

  it('throws UNSUPPORTED_FUNCTION for unknown function', () => {
    const visitor = new EfFunctionVisitor(postgresEfFunctions);
    const node = efNode('unknownFn', prop('col'));
    expect(() => visitor.visit(node, [])).toThrow(AstSqlGenerationError);
  });
});

// ─── SqlVisitor integration ───────────────────────────────────────────────────

describe('SqlVisitor — efFunction routing', () => {
  it('throws when no efFunctionTranslator provided', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question);
    const node: EfFunctionNode = { type: 'efFunction', fn: 'like', args: [] };
    expect(() => visitor.toSql(node, [])).toThrow(AstSqlGenerationError);
    expect(() => visitor.toSql(node, [])).toThrow('efFunctionTranslator');
  });

  it('routes to EfFunctionVisitor when translator provided', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question, {
      efFunctionTranslator: postgresEfFunctions
    });
    const node: EfFunctionNode = {
      type: 'efFunction',
      fn: 'like',
      args: [prop('title'), { type: 'literal', value: '%urgent%' }]
    };
    const result = visitor.toSql(node, []);
    expect(result.condition).toBe('title LIKE ?');
    expect(result.parameters).toEqual(['%urgent%']);
  });
});
