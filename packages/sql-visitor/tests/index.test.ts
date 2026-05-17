import type { BinaryNode } from '@ts-linq/ast';

import { ParameterState, ParameterStyle, SqlVisitor } from '../src/index';

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
