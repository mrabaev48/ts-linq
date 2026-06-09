import type {
  BinaryNode,
  ExpressionNode,
  IsNotNullNode,
  IsNullNode,
  JsonPathExpression,
  MethodNode,
  PropertyNode
} from '@ts-linq/ast';
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

  describe('propagates JSON path into isNull / isNotNull / method positions (task-6)', () => {
    const rewriter = () =>
      new JsonAccessRewriter(new Map([['preferences', makeJsonShape('preferences')]]));

    it('rewrites a JSON path in isNull position into the property field', () => {
      const node: IsNullNode = {
        type: 'isNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      const result = rewriter().rewrite(node) as IsNullNode;
      expect(result.type).toBe('isNull');
      const json = result.property as JsonPathExpression;
      expect(json.type).toBe('jsonPath');
      expect(json.column).toBe('preferences');
      expect(json.path).toEqual(['theme']);
    });

    it('rewrites a JSON path in isNotNull position into the property field', () => {
      const node: IsNotNullNode = {
        type: 'isNotNull',
        property: { type: 'property', path: ['preferences', 'theme'] }
      };
      const result = rewriter().rewrite(node) as IsNotNullNode;
      expect(result.type).toBe('isNotNull');
      const json = result.property as JsonPathExpression;
      expect(json.type).toBe('jsonPath');
      expect(json.column).toBe('preferences');
      expect(json.path).toEqual(['theme']);
    });

    it('rewrites a JSON path object in method position into the object field', () => {
      const node: MethodNode = {
        type: 'method',
        method: 'startsWith',
        object: { type: 'property', path: ['preferences', 'theme'] },
        args: [{ type: 'literal', value: 'x' }]
      };
      const result = rewriter().rewrite(node) as MethodNode;
      expect(result.type).toBe('method');
      expect(result.method).toBe('startsWith');
      expect(result.args).toEqual([{ type: 'literal', value: 'x' }]);
      const json = result.object as JsonPathExpression;
      expect(json.type).toBe('jsonPath');
      expect(json.column).toBe('preferences');
      expect(json.path).toEqual(['theme']);
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
