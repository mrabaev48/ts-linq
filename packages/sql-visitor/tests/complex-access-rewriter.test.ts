import type { BinaryNode, ExpressionNode, PropertyNode } from '@ts-linq/ast';
import type { ComplexTypePropertyMetadata } from '@ts-linq/types';

import { ComplexAccessRewriter } from '../src/ComplexAccessRewriter';

function makeComplex(
  propertyName: string,
  columnPrefix?: string,
  nested: ComplexTypePropertyMetadata[] = []
): ComplexTypePropertyMetadata {
  return {
    propertyName,
    columnPrefix: columnPrefix ?? `${propertyName}_`,
    isRequired: true,
    properties: [],
    nested
  };
}

describe('ComplexAccessRewriter', () => {
  it('passes through single-segment PropertyNode unchanged', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('shippingAddress')]);
    const node: PropertyNode = { type: 'property', name: 'id' };
    expect(rewriter.rewrite(node)).toStrictEqual(node);
  });

  it('passes through multi-segment path when root is not a complex property', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('shippingAddress')]);
    const node: PropertyNode = { type: 'property', path: ['preferences', 'theme'] };
    expect(rewriter.rewrite(node)).toStrictEqual(node);
  });

  it('flattens two-segment path to single PropertyNode with prefixed name', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('shippingAddress')]);
    const node: PropertyNode = { type: 'property', path: ['shippingAddress', 'street'] };
    const result = rewriter.rewrite(node) as PropertyNode;
    expect(result.type).toBe('property');
    expect(result.name).toBe('shippingAddress_street');
    expect(result.path).toBeUndefined();
  });

  it('uses custom columnPrefix when resolving flat name', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('shippingAddress', 'ship_')]);
    const node: PropertyNode = { type: 'property', path: ['shippingAddress', 'city'] };
    const result = rewriter.rewrite(node) as PropertyNode;
    expect(result.name).toBe('ship_city');
  });

  it('flattens nested complex type path with accumulated prefix', () => {
    const coordsMeta = makeComplex('coords', 'coords_');
    const addressMeta = makeComplex('address', 'address_', [coordsMeta]);
    const rewriter = new ComplexAccessRewriter([addressMeta]);
    const node: PropertyNode = { type: 'property', path: ['address', 'coords', 'lat'] };
    const result = rewriter.rewrite(node) as PropertyNode;
    expect(result.name).toBe('address_coords_lat');
  });

  it('rewrites inside binary node operands', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('addr')]);
    const node: BinaryNode = {
      type: 'binary',
      operator: '==',
      left: { type: 'property', path: ['addr', 'street'] },
      right: { type: 'literal', value: 'Main St' }
    };
    const result = rewriter.rewrite(node) as BinaryNode;
    expect((result.left as PropertyNode).name).toBe('addr_street');
  });

  it('rewrites inside logical node operands', () => {
    const rewriter = new ComplexAccessRewriter([makeComplex('addr')]);
    const node: ExpressionNode = {
      type: 'logical',
      operator: '&&',
      left: { type: 'property', path: ['addr', 'city'] },
      right: { type: 'literal', value: 'NYC' }
    };
    const result = rewriter.rewrite(node) as { left: PropertyNode };
    expect(result.left.name).toBe('addr_city');
  });
});
