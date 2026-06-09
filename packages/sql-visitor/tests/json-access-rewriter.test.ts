import type {
  BinaryNode,
  ExpressionNode,
  IsNotNullNode,
  IsNullNode,
  JsonPathExpression,
  MethodNode,
  PropertyNode
} from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { JsonShape } from '@ts-linq/types';

import { JsonAccessRewriter } from '../src/JsonAccessRewriter';

function makeJsonShape(columnName: string): JsonShape {
  return { columnName, properties: new Map() };
}

describe('JsonAccessRewriter', () => {
  it('passes through single-segment PropertyNode unchanged', () => {
    const rewriter = new JsonAccessRewriter(
      new Map([['preferences', makeJsonShape('preferences')]])
    );
    const node: PropertyNode = { type: 'property', name: 'id' };
    expect(rewriter.rewrite(node)).toStrictEqual(node);
  });

  it('does not rewrite multi-segment path when root is not a JSON property', () => {
    const rewriter = new JsonAccessRewriter(
      new Map([['preferences', makeJsonShape('preferences')]])
    );
    const node: PropertyNode = { type: 'property', path: ['address', 'city'] };
    expect(rewriter.rewrite(node)).toStrictEqual(node);
  });

  it('rewrites multi-segment path when root matches a JSON property', () => {
    const rewriter = new JsonAccessRewriter(
      new Map([['preferences', makeJsonShape('preferences')]])
    );
    const node: PropertyNode = { type: 'property', path: ['preferences', 'display', 'theme'] };
    const result = rewriter.rewrite(node) as JsonPathExpression;
    expect(result.type).toBe('jsonPath');
    expect(result.column).toBe('preferences');
    expect(result.path).toEqual(['display', 'theme']);
  });

  it('uses the jsonShape columnName (not property name) as column', () => {
    const rewriter = new JsonAccessRewriter(new Map([['prefs', makeJsonShape('user_prefs_json')]]));
    const node: PropertyNode = { type: 'property', path: ['prefs', 'theme'] };
    const result = rewriter.rewrite(node) as JsonPathExpression;
    expect(result.column).toBe('user_prefs_json');
    expect(result.path).toEqual(['theme']);
  });

  it('rewrites nested binary node', () => {
    const rewriter = new JsonAccessRewriter(
      new Map([['preferences', makeJsonShape('preferences')]])
    );
    const binary: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', path: ['preferences', 'theme'] } as PropertyNode,
      right: { type: 'literal', value: 'dark' }
    };
    const result = rewriter.rewrite(binary) as BinaryNode;
    expect((result.left as JsonPathExpression).type).toBe('jsonPath');
    expect((result.left as JsonPathExpression).path).toEqual(['theme']);
    expect(result.right).toStrictEqual({ type: 'literal', value: 'dark' });
  });

  it('recursively rewrites logical node', () => {
    const rewriter = new JsonAccessRewriter(
      new Map([['preferences', makeJsonShape('preferences')]])
    );
    const node: ExpressionNode = {
      type: 'logical',
      operator: '&&',
      left: {
        type: 'binary',
        operator: '===',
        left: { type: 'property', path: ['preferences', 'a'] },
        right: { type: 'literal', value: 1 }
      },
      right: {
        type: 'binary',
        operator: '===',
        left: { type: 'property', name: 'id' },
        right: { type: 'literal', value: 42 }
      }
    };
    const result = rewriter.rewrite(node);
    const left = (result as any).left.left as JsonPathExpression;
    const right = (result as any).right.left as PropertyNode;
    expect(left.type).toBe('jsonPath');
    expect(right.type).toBe('property');
  });

  describe('fail-loud on JSON path in unsupported positions', () => {
    const rewriter = () =>
      new JsonAccessRewriter(new Map([['preferences', makeJsonShape('preferences')]]));

    it('throws on a JSON path in isNull position', () => {
      const node: IsNullNode = {
        type: 'isNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      expect(() => rewriter().rewrite(node)).toThrow(AstSqlGenerationError);
      try {
        rewriter().rewrite(node);
        throw new Error('expected to throw');
      } catch (e) {
        const err = e as AstSqlGenerationError;
        expect(err).toBeInstanceOf(AstSqlGenerationError);
        expect(err.code).toBe('UNSUPPORTED_JSON_POSITION');
        expect(err.details).toMatchObject({
          nodeType: 'isNull',
          column: 'preferences',
          path: ['theme']
        });
      }
    });

    it('throws on a JSON path in isNotNull position', () => {
      const node: IsNotNullNode = {
        type: 'isNotNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      try {
        rewriter().rewrite(node);
        throw new Error('expected to throw');
      } catch (e) {
        const err = e as AstSqlGenerationError;
        expect(err).toBeInstanceOf(AstSqlGenerationError);
        expect(err.code).toBe('UNSUPPORTED_JSON_POSITION');
        expect(err.details).toMatchObject({ nodeType: 'isNotNull', column: 'preferences' });
      }
    });

    it('throws on a JSON path object in method position', () => {
      const node: MethodNode = {
        type: 'method',
        method: 'startsWith',
        object: { type: 'property', path: ['preferences', 'theme'] },
        args: [{ type: 'literal', value: 'x' }]
      };
      try {
        rewriter().rewrite(node);
        throw new Error('expected to throw');
      } catch (e) {
        const err = e as AstSqlGenerationError;
        expect(err).toBeInstanceOf(AstSqlGenerationError);
        expect(err.code).toBe('UNSUPPORTED_JSON_POSITION');
        expect(err.details).toMatchObject({
          nodeType: 'method',
          column: 'preferences',
          path: ['theme']
        });
      }
    });
  });

  describe('non-JSON properties still pass through these positions unchanged', () => {
    const rewriter = () =>
      new JsonAccessRewriter(new Map([['preferences', makeJsonShape('preferences')]]));

    it('isNull over a scalar property is untouched', () => {
      const node: IsNullNode = { type: 'isNull', property: { type: 'property', name: 'id' } };
      expect(rewriter().rewrite(node)).toStrictEqual(node);
    });

    it('method over a scalar property is untouched', () => {
      const node: MethodNode = {
        type: 'method',
        method: 'startsWith',
        object: { type: 'property', name: 'name' },
        args: [{ type: 'literal', value: 'x' }]
      };
      expect(rewriter().rewrite(node)).toStrictEqual(node);
    });
  });
});
