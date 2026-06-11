import type { BinaryNode } from '@ts-linq/ast';

import * as publicApi from '../src/index';
import { ParameterState, ParameterStyle, SqlVisitor } from '../src/index';
import * as internalApi from '../src/internal';

describe('@ts-linq/sql-visitor exports', () => {
  it('exports SqlVisitor', () => {
    expect(SqlVisitor).toBeDefined();
    const visitor = new SqlVisitor();
    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'id' },
      right: { type: 'literal', value: 1 }
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(id = ?)');
    expect(result.parameters).toEqual([1]);
  });

  it('exports ParameterStyle enum', () => {
    expect(ParameterStyle).toBeDefined();
    expect(ParameterStyle.Question).toBe('question');
    expect(ParameterStyle.Positional).toBe('positional');
    expect(ParameterStyle.Named).toBe('named');
  });

  it('exports ParameterState class', () => {
    expect(ParameterState).toBeDefined();
    const state = new ParameterState(ParameterStyle.Positional);
    expect(state.next()).toBe('$1');
    expect(state.next()).toBe('$2');
  });

  it('SqlVisitor with ParameterStyle.Positional produces $N placeholders', () => {
    const visitor = new SqlVisitor(ParameterStyle.Positional);
    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'id' },
      right: { type: 'literal', value: 42 }
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(id = $1)');
    expect(result.parameters).toEqual([42]);
  });

  it('SqlVisitor with ParameterStyle.Named produces @pN placeholders', () => {
    const visitor = new SqlVisitor(ParameterStyle.Named);
    const node: BinaryNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'property', name: 'id' },
      right: { type: 'literal', value: 42 }
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(id = @p1)');
    expect(result.parameters).toEqual([42]);
  });
});

describe('@ts-linq/sql-visitor public barrel snapshot', () => {
  // Runtime (value) exports of the curated public barrel. Type-only exports are erased and do not
  // appear here. This snapshot fails if a sub-visitor or free helper is accidentally re-added to
  // the public surface — those collaborators must stay behind `@ts-linq/sql-visitor/internal`.
  const EXPECTED_PUBLIC_EXPORTS = [
    'CallSyntaxEmitter',
    'ComplexAccessRewriter',
    'ExecSyntaxEmitter',
    'JsonAccessRewriter',
    'ParameterState',
    'ParameterStyle',
    'SqlVisitor',
    'buildQuestionMarkRows',
    'calcChunkSize',
    'chunkArray',
    'emitTagComments',
    'hasVisitorSupport',
    'renderJoinOn'
  ];

  it('exposes exactly the curated public value exports', () => {
    expect(Object.keys(publicApi).sort()).toEqual([...EXPECTED_PUBLIC_EXPORTS].sort());
  });

  it('does not leak sub-visitors through the public barrel', () => {
    const leaked = Object.keys(publicApi).filter(
      (name) => name.endsWith('Visitor') && name !== 'SqlVisitor'
    );
    expect(leaked).toEqual([]);
  });

  it('keeps sub-visitors reachable via the internal subpath', () => {
    expect(internalApi.FragmentJoinPlanner).toBeDefined();
    expect(internalApi.BinaryVisitor).toBeDefined();
    expect(internalApi.SpatialMethodVisitor).toBeDefined();
  });
});
