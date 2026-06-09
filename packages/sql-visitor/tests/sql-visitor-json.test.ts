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

  describe('JSON path in isNull / isNotNull / method positions (task-6)', () => {
    const makeVisitor = () => {
      const rewriter = new JsonAccessRewriter(new Map([['preferences', makeShape('preferences')]]));
      return new SqlVisitor(ParameterStyle.Question, {
        jsonPathTranslator: stubTranslator,
        jsonAccessRewriter: rewriter
      });
    };

    it('wraps a JSON path in IS NULL with zero spurious parameters', () => {
      // Simulates: where(u => u.preferences.theme == null)
      const node: ExpressionNode = {
        type: 'isNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      const { condition, parameters } = makeVisitor().toSql(node);
      expect(condition).toBe('(JSON_PATH(preferences,theme) IS NULL)');
      expect(parameters).toEqual([]);
    });

    it('wraps a JSON path in IS NOT NULL with zero spurious parameters', () => {
      const node: ExpressionNode = {
        type: 'isNotNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      const { condition, parameters } = makeVisitor().toSql(node);
      expect(condition).toBe('(JSON_PATH(preferences,theme) IS NOT NULL)');
      expect(parameters).toEqual([]);
    });

    it('wraps a JSON path object in LIKE with exactly one bound parameter', () => {
      // Simulates: where(u => u.preferences.theme.startsWith('d'))
      const node: ExpressionNode = {
        type: 'method',
        method: 'startsWith',
        object: { type: 'property', path: ['preferences', 'theme'] },
        args: [{ type: 'literal', value: 'd' }]
      };
      const { condition, parameters } = makeVisitor().toSql(node);
      expect(condition).toBe('(JSON_PATH(preferences,theme) LIKE ?)');
      expect(parameters).toEqual(['d%']);
    });
  });
});
