import { BinaryVisitor, renderPropertyName } from '../src/visitors/BinaryVisitor';
import { LogicalVisitor } from '../src/visitors/LogicalVisitor';
import { NullVisitor } from '../src/visitors/NullVisitor';
import { InVisitor } from '../src/visitors/InVisitor';
import { MethodVisitor } from '../src/visitors/MethodVisitor';
import { SqlVisitor } from '../src/ast/SqlVisitor';
import type {
  BinaryNode,
  LogicalNode,
  NotNode,
  PropertyNode,
  LiteralNode,
  IsNullNode,
  IsNotNullNode,
  InNode,
  MethodNode,
  ExpressionNode,
} from '../src/ast/Nodes';
import { AstSqlGenerationError } from '../src/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prop = (name: string): PropertyNode => ({ type: 'property', name });
const propPath = (...segs: string[]): PropertyNode => ({ type: 'property', path: segs });
const lit = (value: number | string | boolean | null): LiteralNode => ({ type: 'literal', value });

const noop = (): { condition: string; parameters: never[] } => ({ condition: '1=1', parameters: [] });

const makeRecurse =
  (visitor: SqlVisitor, inputParameters: readonly unknown[] = []) =>
  (n: ExpressionNode) =>
    visitor.toSql(n, inputParameters as number[]);

// ─── BinaryVisitor ────────────────────────────────────────────────────────────

describe('BinaryVisitor', () => {
  let visitor: BinaryVisitor;
  let sqlVisitor: SqlVisitor;

  beforeEach(() => {
    visitor = new BinaryVisitor();
    sqlVisitor = new SqlVisitor();
  });

  it('equality comparison (===)', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: prop('id'), right: lit(1),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(id = ?)');
    expect(result.parameters).toEqual([1]);
  });

  it('greater than comparison', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>',
      left: prop('age'), right: lit(18),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(age > ?)');
    expect(result.parameters).toEqual([18]);
  });

  it('greater than or equal', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>=',
      left: prop('salary'), right: lit(50000),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(salary >= ?)');
    expect(result.parameters).toEqual([50000]);
  });

  it('less than', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '<',
      left: prop('price'), right: lit(100),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(price < ?)');
    expect(result.parameters).toEqual([100]);
  });

  it('less than or equal', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '<=',
      left: prop('quantity'), right: lit(10),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(quantity <= ?)');
    expect(result.parameters).toEqual([10]);
  });

  it('string value', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: prop('name'), right: lit('Alice'),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(name = ?)');
    expect(result.parameters).toEqual(['Alice']);
  });

  it('boolean value', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: prop('active'), right: lit(true),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(active = ?)');
    expect(result.parameters).toEqual([true]);
  });

  it('null value', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: prop('deletedAt'), right: lit(null),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(deletedAt = ?)');
    expect(result.parameters).toEqual([null]);
  });

  it('resolves ParameterRef from input parameters', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>=',
      left: prop('age'), right: { type: 'parameterRef', index: 0 },
    };
    const result = visitor.visit(node, [21], makeRecurse(sqlVisitor, [21]));
    expect(result.condition).toBe('(age >= ?)');
    expect(result.parameters).toEqual([21]);
  });

  it('throws on out-of-range ParameterRef index', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>=',
      left: prop('age'), right: { type: 'parameterRef', index: 5 },
    };
    expect(() => visitor.visit(node, [21], makeRecurse(sqlVisitor, [21]))).toThrow(AstSqlGenerationError);
  });

  it('multi-segment property path', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>=',
      left: propPath('profile', 'age'), right: lit(18),
    };
    const result = visitor.visit(node, [], makeRecurse(sqlVisitor));
    expect(result.condition).toBe('(profile.age >= ?)');
    expect(result.parameters).toEqual([18]);
  });

  it('renderPropertyName throws for empty node', () => {
    expect(() => renderPropertyName({ type: 'property' })).toThrow(AstSqlGenerationError);
  });
});

// ─── LogicalVisitor ────────────────────────────────────────────────────────────

describe('LogicalVisitor', () => {
  let visitor: LogicalVisitor;

  beforeEach(() => {
    visitor = new LogicalVisitor();
  });

  const binaryResult = (condition: string, params: unknown[]) => () => ({
    condition,
    parameters: params as number[],
  });

  it('AND expression', () => {
    const node: LogicalNode = {
      type: 'logical', operator: '&&',
      left: {} as ExpressionNode,
      right: {} as ExpressionNode,
    };
    const result = visitor.visit(node, (n) => {
      if (n === node.left)  return { condition: '(age > ?)', parameters: [18] };
      return { condition: '(active = ?)', parameters: [true] };
    });
    expect(result.condition).toBe('((age > ?) AND (active = ?))');
    expect(result.parameters).toEqual([18, true]);
  });

  it('OR expression', () => {
    const node: LogicalNode = {
      type: 'logical', operator: '||',
      left: {} as ExpressionNode,
      right: {} as ExpressionNode,
    };
    const result = visitor.visit(node, (n) => {
      if (n === node.left)  return { condition: "(role = ?)", parameters: ['admin'] };
      return { condition: "(role = ?)", parameters: ['mod'] };
    });
    expect(result.condition).toBe("((role = ?) OR (role = ?))");
    expect(result.parameters).toEqual(['admin', 'mod']);
  });
});

// ─── NullVisitor ─────────────────────────────────────────────────────────────

describe('NullVisitor', () => {
  let visitor: NullVisitor;

  beforeEach(() => { visitor = new NullVisitor(); });

  it('IS NULL', () => {
    const node: IsNullNode = { type: 'isNull', property: prop('deletedAt') };
    const result = visitor.visitIsNull(node);
    expect(result.condition).toBe('(deletedAt IS NULL)');
    expect(result.parameters).toEqual([]);
  });

  it('IS NOT NULL', () => {
    const node: IsNotNullNode = { type: 'isNotNull', property: prop('deletedAt') };
    const result = visitor.visitIsNotNull(node);
    expect(result.condition).toBe('(deletedAt IS NOT NULL)');
    expect(result.parameters).toEqual([]);
  });
});

// ─── InVisitor ───────────────────────────────────────────────────────────────

describe('InVisitor', () => {
  let visitor: InVisitor;

  beforeEach(() => { visitor = new InVisitor(); });

  it('IN with inline literal values', () => {
    const node: InNode = {
      type: 'in',
      property: prop('role'),
      values: [lit('admin'), lit('mod')] as LiteralNode[],
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('(role IN (?, ?))');
    expect(result.parameters).toEqual(['admin', 'mod']);
  });

  it('IN with empty values → (1 = 0)', () => {
    const node: InNode = { type: 'in', property: prop('role'), values: [] };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('(1 = 0)');
  });

  it('IN with external array via valuesRef', () => {
    const roles = ['admin', 'mod'];
    const node: InNode = { type: 'in', property: prop('role'), valuesRef: 0 };
    const result = visitor.visit(node, [roles]);
    expect(result.condition).toBe('(role IN (?, ?))');
    expect(result.parameters).toEqual(['admin', 'mod']);
  });

  it('throws when valuesRef resolves to non-array', () => {
    const node: InNode = { type: 'in', property: prop('x'), valuesRef: 0 };
    expect(() => visitor.visit(node, ['not-an-array'])).toThrow(AstSqlGenerationError);
  });
});

// ─── MethodVisitor ────────────────────────────────────────────────────────────

describe('MethodVisitor', () => {
  let visitor: MethodVisitor;

  beforeEach(() => { visitor = new MethodVisitor(); });

  it('includes → LIKE %value%', () => {
    const node: MethodNode = {
      type: 'method', method: 'includes',
      object: prop('name'),
      args: [lit('foo')] as LiteralNode[],
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('(name LIKE ?)');
    expect(result.parameters).toEqual(['%foo%']);
  });

  it('startsWith → LIKE value%', () => {
    const node: MethodNode = {
      type: 'method', method: 'startsWith',
      object: prop('name'),
      args: [lit('Al')] as LiteralNode[],
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('(name LIKE ?)');
    expect(result.parameters).toEqual(['Al%']);
  });

  it('endsWith → LIKE %value', () => {
    const node: MethodNode = {
      type: 'method', method: 'endsWith',
      object: prop('name'),
      args: [lit('.ts')] as LiteralNode[],
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('(name LIKE ?)');
    expect(result.parameters).toEqual(['%.ts']);
  });
});

// ─── SqlVisitor (integration) ─────────────────────────────────────────────────

describe('SqlVisitor', () => {
  let visitor: SqlVisitor;

  beforeEach(() => { visitor = new SqlVisitor(); });

  it('simple binary expression', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '===',
      left: prop('userId'), right: lit(42),
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(userId = ?)');
    expect(result.parameters).toEqual([42]);
  });

  it('AND logical expression', () => {
    const node: LogicalNode = {
      type: 'logical', operator: '&&',
      left: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
      right: { type: 'binary', operator: '===', left: prop('active'), right: lit(true) },
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('((age > ?) AND (active = ?))');
    expect(result.parameters).toEqual([18, true]);
  });

  it('OR logical expression', () => {
    const node: LogicalNode = {
      type: 'logical', operator: '||',
      left: { type: 'binary', operator: '===', left: prop('status'), right: lit('pending') },
      right: { type: 'binary', operator: '===', left: prop('status'), right: lit('processing') },
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('((status = ?) OR (status = ?))');
    expect(result.parameters).toEqual(['pending', 'processing']);
  });

  it('nested AND inside OR (left-associative)', () => {
    const a: BinaryNode = { type: 'binary', operator: '===', left: prop('active'), right: lit(true) };
    const b: BinaryNode = { type: 'binary', operator: '===', left: prop('role'), right: lit('admin') };
    const c: BinaryNode = { type: 'binary', operator: '===', left: prop('role'), right: lit('mod') };

    // active AND (admin OR mod)
    const node: LogicalNode = {
      type: 'logical', operator: '&&', left: a,
      right: { type: 'logical', operator: '||', left: b, right: c },
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('((active = ?) AND ((role = ?) OR (role = ?)))');
    expect(result.parameters).toEqual([true, 'admin', 'mod']);
  });

  it('IS NULL', () => {
    const node: IsNullNode = { type: 'isNull', property: prop('deletedAt') };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(deletedAt IS NULL)');
    expect(result.parameters).toEqual([]);
  });

  it('IS NOT NULL', () => {
    const node: IsNotNullNode = { type: 'isNotNull', property: prop('updatedAt') };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(updatedAt IS NOT NULL)');
    expect(result.parameters).toEqual([]);
  });

  it('IN expression (inline values)', () => {
    const node: InNode = {
      type: 'in', property: prop('role'),
      values: [lit('admin'), lit('mod')] as LiteralNode[],
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(role IN (?, ?))');
    expect(result.parameters).toEqual(['admin', 'mod']);
  });

  it('IN expression (external array)', () => {
    const roles = ['admin', 'mod'];
    const node: InNode = { type: 'in', property: prop('role'), valuesRef: 0 };
    const result = visitor.toSql(node, [roles]);
    expect(result.condition).toBe('(role IN (?, ?))');
    expect(result.parameters).toEqual(['admin', 'mod']);
  });

  it('string method: name.startsWith', () => {
    const node: MethodNode = {
      type: 'method', method: 'startsWith',
      object: prop('name'),
      args: [lit('Al')] as LiteralNode[],
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(name LIKE ?)');
    expect(result.parameters).toEqual(['Al%']);
  });

  it('NOT over property → (col = false)', () => {
    const node: NotNode = { type: 'not', operand: prop('isActive') };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(isActive = ?)');
    expect(result.parameters).toEqual([false]);
  });

  it('NOT over binary expression', () => {
    const node: NotNode = {
      type: 'not',
      operand: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
    };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(NOT (age > ?))');
    expect(result.parameters).toEqual([18]);
  });

  it('NOT over logical expression', () => {
    const andNode: LogicalNode = {
      type: 'logical', operator: '&&',
      left: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
      right: { type: 'binary', operator: '===', left: prop('active'), right: lit(true) },
    };
    const node: NotNode = { type: 'not', operand: andNode };
    const result = visitor.toSql(node);
    expect(result.condition).toBe('(NOT ((age > ?) AND (active = ?)))');
    expect(result.parameters).toEqual([18, true]);
  });

  it('ParameterRef at runtime', () => {
    const node: BinaryNode = {
      type: 'binary', operator: '>=',
      left: prop('age'), right: { type: 'parameterRef', index: 0 },
    };
    const result = visitor.toSql(node, [21]);
    expect(result.condition).toBe('(age >= ?)');
    expect(result.parameters).toEqual([21]);
  });

  it('throws on unknown node type', () => {
    const node = { type: 'UnknownExpression' } as unknown as ExpressionNode;
    expect(() => visitor.toSql(node)).toThrow(AstSqlGenerationError);
  });

  it('throws on unsupported node', () => {
    const node = {
      type: 'unsupported', syntaxKind: 0, description: 'test',
    } as ExpressionNode;
    expect(() => visitor.toSql(node)).toThrow(AstSqlGenerationError);
  });
});
