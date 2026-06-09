import type { BinaryNode } from '@ts-linq/ast';
import { ValueConverter } from '@ts-linq/metadata';

import { ParameterState, ParameterStyle } from '../src/ParameterStyle';
import { BinaryVisitor } from '../src/visitors/BinaryVisitor';
import { makeCtx } from './helpers/makeCtx';

describe('BinaryVisitor converter lifting', () => {
  const visitor = new BinaryVisitor();

  it('applies toProvider to a literal when the opposite property has a converter', () => {
    const conv = new ValueConverter<string, string>(
      (v) => v.toUpperCase(),
      (v) => v.toLowerCase()
    );

    const converterResolver = (propName: string) => (propName === 'role' ? conv : undefined);

    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'role' },
      right: { type: 'literal', value: 'admin' }
    };

    const state = new ParameterState(ParameterStyle.Question);
    const recurse = () => ({ condition: '', parameters: [] });
    const result = visitor.visit(node, makeCtx({ state, converterResolver, recurse }));

    // The parameter value should be 'ADMIN' (converted) not 'admin' (raw)
    expect(result.parameters).toEqual(['ADMIN']);
  });

  it('applies toProvider when property is on the right side', () => {
    const conv = new ValueConverter<boolean, number>(
      (v) => (v ? 1 : 0),
      (v) => v !== 0
    );

    const converterResolver = (propName: string) => (propName === 'active' ? conv : undefined);

    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'literal', value: true },
      right: { type: 'property', name: 'active' }
    };

    const state = new ParameterState(ParameterStyle.Question);
    const recurse = () => ({ condition: '', parameters: [] });
    const result = visitor.visit(node, makeCtx({ state, converterResolver, recurse }));

    expect(result.parameters).toEqual([1]);
  });

  it('does not apply conversion when no converter is registered for the property', () => {
    const converterResolver = () => undefined;

    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'name' },
      right: { type: 'literal', value: 'alice' }
    };

    const state = new ParameterState(ParameterStyle.Question);
    const recurse = () => ({ condition: '', parameters: [] });
    const result = visitor.visit(node, makeCtx({ state, converterResolver, recurse }));

    expect(result.parameters).toEqual(['alice']);
  });
});
