import { SqlVisitor } from '../src/index';
import type { BinaryNode } from '@ts-linq/ast';

describe('@ts-linq/sql-visitor exports', () => {
  it('exports SqlVisitor', () => {
    expect(SqlVisitor).toBeDefined();
    const visitor = new SqlVisitor();
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: { type: 'property', name: 'id' },
      right: { type: 'literal', value: 1 },
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(id = ?)');
    expect(result.parameters).toEqual([1]);
  });
});
