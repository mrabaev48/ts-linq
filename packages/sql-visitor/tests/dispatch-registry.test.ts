import { describe, expect, it } from '@jest/globals';
import type { ExpressionNode, JsonPathExpression } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SqlParameter } from '@ts-linq/types';

import { postgresEfFunctions } from '../../dialect-postgres/src/functions/index';
import { ParameterStyle } from '../src/ParameterStyle';
import { SqlVisitor } from '../src/SqlVisitor';
import type { JsonPathTranslator } from '../src/visitors/JsonPathVisitor';

/**
 * Golden corpus: each entry must render byte-identically through the registry-based dispatch.
 * Covers every always-available node type so the dispatch table is exercised end-to-end.
 */
interface CorpusEntry {
  readonly name: string;
  readonly node: ExpressionNode;
  readonly inputParameters?: readonly unknown[];
  readonly condition: string;
  readonly parameters: SqlParameter[];
}

const property = (name: string) => ({ type: 'property' as const, name });
const literal = (value: number | string | boolean | null) => ({ type: 'literal' as const, value });

const CORPUS: CorpusEntry[] = [
  {
    name: 'binary',
    node: { type: 'binary', operator: '===', left: property('id'), right: literal(1) },
    condition: '(id = ?)',
    parameters: [1]
  },
  {
    name: 'logical',
    node: {
      type: 'logical',
      operator: '&&',
      left: { type: 'binary', operator: '>', left: property('age'), right: literal(18) },
      right: { type: 'binary', operator: '===', left: property('active'), right: literal(true) }
    },
    condition: '((age > ?) AND (active = ?))',
    parameters: [18, true]
  },
  {
    name: 'not',
    node: { type: 'not', operand: property('active') },
    condition: '(active = ?)',
    parameters: [false]
  },
  {
    name: 'isNull',
    node: { type: 'isNull', property: property('deletedAt') },
    condition: '(deletedAt IS NULL)',
    parameters: []
  },
  {
    name: 'isNotNull',
    node: { type: 'isNotNull', property: property('deletedAt') },
    condition: '(deletedAt IS NOT NULL)',
    parameters: []
  },
  {
    name: 'in',
    node: { type: 'in', property: property('role'), values: [literal('admin'), literal('mod')] },
    condition: '(role IN (?, ?))',
    parameters: ['admin', 'mod']
  },
  {
    name: 'method',
    node: { type: 'method', method: 'includes', object: property('name'), args: [literal('foo')] },
    condition: '(name LIKE ?)',
    parameters: ['%foo%']
  }
];

describe('SqlVisitor dispatch — golden corpus', () => {
  it.each(CORPUS)(
    'renders $name byte-identically',
    ({ node, inputParameters, condition, parameters }) => {
      const result = new SqlVisitor().toSql(node, inputParameters ?? []);
      expect(result.condition).toBe(condition);
      expect(result.parameters).toEqual(parameters);
    }
  );
});

describe('SqlVisitor dispatch — registry routing', () => {
  it('throws AstSqlGenerationError for an unknown node type', () => {
    const bogus = { type: 'bogus' } as unknown as ExpressionNode;
    expect(() => new SqlVisitor().toSql(bogus)).toThrow(AstSqlGenerationError);
    expect(() => new SqlVisitor().toSql(bogus)).toThrow("Unsupported root node type: 'bogus'");
  });

  it('throws for an `unsupported` sentinel node with its description', () => {
    const node = {
      type: 'unsupported',
      syntaxKind: 42,
      description: 'spread element'
    } as unknown as ExpressionNode;
    expect(() => new SqlVisitor().toSql(node)).toThrow(
      'Unsupported expression in WHERE clause: spread element'
    );
  });
});

describe('SqlVisitor dispatch — optional visitors register conditionally', () => {
  const efNode: ExpressionNode = {
    type: 'efFunction',
    fn: 'like',
    args: [property('title'), literal('%x%')]
  };

  const jsonNode: JsonPathExpression = { type: 'jsonPath', column: 'data', path: ['a'] };
  const jsonTranslator: JsonPathTranslator = {
    translate: (n) => ({ fragment: `json(${n.column})`, params: [] })
  };

  it('efFunction throws when no translator configured', () => {
    expect(() => new SqlVisitor().toSql(efNode)).toThrow('efFunctionTranslator');
  });

  it('efFunction succeeds when translator configured', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question, {
      efFunctionTranslator: postgresEfFunctions
    });
    const result = visitor.toSql(efNode);
    expect(result.condition).toBe('title LIKE ?');
    expect(result.parameters).toEqual(['%x%']);
  });

  it('jsonPath throws when no translator configured', () => {
    expect(() => new SqlVisitor().toSql(jsonNode)).toThrow('jsonPathTranslator');
  });

  it('jsonPath succeeds when translator configured', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question, {
      jsonPathTranslator: jsonTranslator
    });
    const result = visitor.toSql(jsonNode);
    expect(result.condition).toBe('json(data)');
    expect(result.parameters).toEqual([]);
  });
});
