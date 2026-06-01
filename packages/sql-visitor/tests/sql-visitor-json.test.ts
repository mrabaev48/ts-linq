import type { ExpressionNode } from '@ts-linq/ast';
import type { JsonShape } from '@ts-linq/types';

import { JsonAccessRewriter } from '../src/JsonAccessRewriter';
import { ParameterStyle } from '../src/ParameterStyle';
import { SqlVisitor } from '../src/SqlVisitor';
import type { JsonPathTranslator } from '../src/visitors/JsonPathVisitor';

function makeShape(columnName: string): JsonShape {
  return { columnName, properties: new Map() };
}

const stubTranslator: JsonPathTranslator = {
  translate(node, _state) {
    return { fragment: `JSON_PATH(${node.column},${node.path.join('.')})`, params: [] };
  }
};

describe('SqlVisitor — JSON path integration', () => {
  it('rewrites and translates a binary node with a JSON path property', () => {
    const jsonOwnedProps = new Map([['preferences', makeShape('preferences')]]);
    const rewriter = new JsonAccessRewriter(jsonOwnedProps);

    const visitor = new SqlVisitor(ParameterStyle.Question, {
      jsonPathTranslator: stubTranslator,
      jsonAccessRewriter: rewriter
    });

    // Simulates: where(u => u.preferences.theme === 'dark')
    const node: ExpressionNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', path: ['preferences', 'theme'] },
      right: { type: 'literal', value: 'dark' }
    };

    const { condition, parameters } = visitor.toSql(node);
    expect(condition).toContain('JSON_PATH(preferences,theme)');
    expect(parameters).toContain('dark');
  });

  it('throws when jsonPath node is encountered without a translator', () => {
    const jsonOwnedProps = new Map([['preferences', makeShape('preferences')]]);
    const rewriter = new JsonAccessRewriter(jsonOwnedProps);

    const visitor = new SqlVisitor(ParameterStyle.Question, {
      jsonAccessRewriter: rewriter
    });

    const node: ExpressionNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', path: ['preferences', 'theme'] },
      right: { type: 'literal', value: 'dark' }
    };

    expect(() => visitor.toSql(node)).toThrow('jsonPathTranslator');
  });

  it('passes through regular property nodes untouched', () => {
    const jsonOwnedProps = new Map([['preferences', makeShape('preferences')]]);
    const rewriter = new JsonAccessRewriter(jsonOwnedProps);

    const visitor = new SqlVisitor(ParameterStyle.Question, {
      jsonPathTranslator: stubTranslator,
      jsonAccessRewriter: rewriter
    });

    const node: ExpressionNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'id' },
      right: { type: 'literal', value: 1 }
    };

    const { condition } = visitor.toSql(node);
    expect(condition).toContain('id');
    expect(condition).not.toContain('JSON_PATH');
  });
});
