import { BinaryVisitor, renderPropertyName, type ColumnResolver } from '../src/visitors/BinaryVisitor';
import { LogicalVisitor } from '../src/visitors/LogicalVisitor';
import { NullVisitor } from '../src/visitors/NullVisitor';
import { InVisitor } from '../src/visitors/InVisitor';
import { MethodVisitor } from '../src/visitors/MethodVisitor';
import { SqlVisitor } from '../src/SqlVisitor';
import { ParameterStyle } from '../src/ParameterStyle';
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
} from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prop = (name: string): PropertyNode => ({ type: 'property', name });
const propPath = (...segs: string[]): PropertyNode => ({ type: 'property', path: segs });
const lit = (value: number | string | boolean | null): LiteralNode => ({ type: 'literal', value });

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

// ─── ColumnResolver ───────────────────────────────────────────────────────────

describe('ColumnResolver', () => {
  const snakeCaseResolver: ColumnResolver = (node) => {
    const raw = node.name ?? node.path?.[node.path.length - 1] ?? '';
    const colName = raw.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (node.path && node.path.length > 1) {
      return [...node.path.slice(0, -1), colName].join('.');
    }
    return colName;
  };

  describe('SqlVisitor.toSql with resolver', () => {
    let visitor: SqlVisitor;
    beforeEach(() => { visitor = new SqlVisitor(); });

    it('resolves single property name via resolver', () => {
      const node: BinaryNode = {
        type: 'binary', operator: '===',
        left: prop('userId'), right: lit(42),
      };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(user_id = ?)');
      expect(result.parameters).toEqual([42]);
    });

    it('resolves property name in IS NULL', () => {
      const node: IsNullNode = { type: 'isNull', property: prop('deletedAt') };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(deleted_at IS NULL)');
    });

    it('resolves property name in IS NOT NULL', () => {
      const node: IsNotNullNode = { type: 'isNotNull', property: prop('createdAt') };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(created_at IS NOT NULL)');
    });

    it('resolves property name in IN expression', () => {
      const node: InNode = {
        type: 'in',
        property: prop('roleId'),
        values: [lit(1), lit(2)] as LiteralNode[],
      };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(role_id IN (?, ?))');
    });

    it('resolves property name in LIKE (startsWith)', () => {
      const node: MethodNode = {
        type: 'method', method: 'startsWith',
        object: prop('firstName'),
        args: [lit('Jo')] as LiteralNode[],
      };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(first_name LIKE ?)');
      expect(result.parameters).toEqual(['Jo%']);
    });

    it('resolves property name in NOT (property)', () => {
      const node: NotNode = { type: 'not', operand: prop('isActive') };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('(is_active = ?)');
      expect(result.parameters).toEqual([false]);
    });

    it('resolves through AND logical expression', () => {
      const node: LogicalNode = {
        type: 'logical', operator: '&&',
        left: { type: 'binary', operator: '===', left: prop('userId'), right: lit(1) },
        right: { type: 'isNull', property: prop('deletedAt') },
      };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('((user_id = ?) AND (deleted_at IS NULL))');
    });

    it('resolves through OR logical expression', () => {
      const node: LogicalNode = {
        type: 'logical', operator: '||',
        left: { type: 'binary', operator: '===', left: prop('userId'), right: lit(1) },
        right: { type: 'binary', operator: '===', left: prop('roleId'), right: lit(2) },
      };
      const result = visitor.toSql(node, [], snakeCaseResolver);
      expect(result.condition).toBe('((user_id = ?) OR (role_id = ?))');
    });

    it('falls back to original property name when no resolver is supplied', () => {
      const node: BinaryNode = {
        type: 'binary', operator: '===',
        left: prop('userId'), right: lit(42),
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(userId = ?)');
    });
  });

  describe('renderPropertyName with resolver', () => {
    it('uses resolver result over node.name', () => {
      const node: PropertyNode = { type: 'property', name: 'userId' };
      const resolver: ColumnResolver = () => 'user_id';
      expect(renderPropertyName(node, resolver)).toBe('user_id');
    });

    it('without resolver uses node.name', () => {
      const node: PropertyNode = { type: 'property', name: 'userId' };
      expect(renderPropertyName(node)).toBe('userId');
    });
  });
});

// ─── ParameterStyle ───────────────────────────────────────────────────────────

describe('ParameterStyle', () => {
  describe('Positional ($1, $2, ...)', () => {
    let visitor: SqlVisitor;
    beforeEach(() => { visitor = new SqlVisitor(ParameterStyle.Positional); });

    it('single binary node → $1', () => {
      const node: BinaryNode = {
        type: 'binary', operator: '>',
        left: prop('age'), right: lit(18),
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(age > $1)');
      expect(result.parameters).toEqual([18]);
    });

    it('AND expression → $1 and $2', () => {
      const node: LogicalNode = {
        type: 'logical', operator: '&&',
        left: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
        right: { type: 'binary', operator: '===', left: prop('active'), right: lit(true) },
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('((age > $1) AND (active = $2))');
      expect(result.parameters).toEqual([18, true]);
    });

    it('OR expression → $1 and $2', () => {
      const node: LogicalNode = {
        type: 'logical', operator: '||',
        left: { type: 'binary', operator: '===', left: prop('status'), right: lit('a') },
        right: { type: 'binary', operator: '===', left: prop('status'), right: lit('b') },
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('((status = $1) OR (status = $2))');
      expect(result.parameters).toEqual(['a', 'b']);
    });

    it('IN expression (3 values) → $1, $2, $3', () => {
      const node: InNode = {
        type: 'in', property: prop('role'),
        values: [lit('admin'), lit('mod'), lit('viewer')] as LiteralNode[],
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(role IN ($1, $2, $3))');
      expect(result.parameters).toEqual(['admin', 'mod', 'viewer']);
    });

    it('IN with external array → $1, $2', () => {
      const roles = ['admin', 'mod'];
      const node: InNode = { type: 'in', property: prop('role'), valuesRef: 0 };
      const result = visitor.toSql(node, [roles]);
      expect(result.condition).toBe('(role IN ($1, $2))');
      expect(result.parameters).toEqual(['admin', 'mod']);
    });

    it('string method (startsWith) → LIKE $1', () => {
      const node: MethodNode = {
        type: 'method', method: 'startsWith',
        object: prop('name'),
        args: [lit('Al')] as LiteralNode[],
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(name LIKE $1)');
      expect(result.parameters).toEqual(['Al%']);
    });

    it('NOT over property → $1', () => {
      const node: NotNode = { type: 'not', operand: prop('isActive') };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(isActive = $1)');
      expect(result.parameters).toEqual([false]);
    });

    it('nested AND inside OR numbers continuously', () => {
      const a: BinaryNode = { type: 'binary', operator: '===', left: prop('active'), right: lit(true) };
      const b: BinaryNode = { type: 'binary', operator: '===', left: prop('role'), right: lit('admin') };
      const c: BinaryNode = { type: 'binary', operator: '===', left: prop('role'), right: lit('mod') };
      const node: LogicalNode = {
        type: 'logical', operator: '&&', left: a,
        right: { type: 'logical', operator: '||', left: b, right: c },
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('((active = $1) AND ((role = $2) OR (role = $3)))');
      expect(result.parameters).toEqual([true, 'admin', 'mod']);
    });

    it('ParameterRef resolves to positional placeholder', () => {
      const node: BinaryNode = {
        type: 'binary', operator: '>=',
        left: prop('age'), right: { type: 'parameterRef', index: 0 },
      };
      const result = visitor.toSql(node, [21]);
      expect(result.condition).toBe('(age >= $1)');
      expect(result.parameters).toEqual([21]);
    });
  });

  describe('Named (@p1, @p2, ...)', () => {
    let visitor: SqlVisitor;
    beforeEach(() => { visitor = new SqlVisitor(ParameterStyle.Named); });

    it('single binary node → @p1', () => {
      const node: BinaryNode = {
        type: 'binary', operator: '>',
        left: prop('age'), right: lit(18),
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(age > @p1)');
      expect(result.parameters).toEqual([18]);
    });

    it('AND expression → @p1 and @p2', () => {
      const node: LogicalNode = {
        type: 'logical', operator: '&&',
        left: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
        right: { type: 'binary', operator: '===', left: prop('active'), right: lit(true) },
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('((age > @p1) AND (active = @p2))');
      expect(result.parameters).toEqual([18, true]);
    });

    it('string method (startsWith) → LIKE @p1', () => {
      const node: MethodNode = {
        type: 'method', method: 'startsWith',
        object: prop('name'),
        args: [lit('Al')] as LiteralNode[],
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(name LIKE @p1)');
      expect(result.parameters).toEqual(['Al%']);
    });

    it('IN expression (2 values) → @p1, @p2', () => {
      const node: InNode = {
        type: 'in', property: prop('role'),
        values: [lit('admin'), lit('mod')] as LiteralNode[],
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(role IN (@p1, @p2))');
      expect(result.parameters).toEqual(['admin', 'mod']);
    });
  });

  describe('Question (default, backward compat)', () => {
    it('default constructor still produces ?', () => {
      const visitor = new SqlVisitor();
      const node: BinaryNode = {
        type: 'binary', operator: '===',
        left: prop('id'), right: lit(1),
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('(id = ?)');
      expect(result.parameters).toEqual([1]);
    });

    it('explicit Question style produces ?', () => {
      const visitor = new SqlVisitor(ParameterStyle.Question);
      const node: LogicalNode = {
        type: 'logical', operator: '&&',
        left: { type: 'binary', operator: '>', left: prop('age'), right: lit(18) },
        right: { type: 'binary', operator: '===', left: prop('active'), right: lit(true) },
      };
      const result = visitor.toSql(node);
      expect(result.condition).toBe('((age > ?) AND (active = ?))');
      expect(result.parameters).toEqual([18, true]);
    });
  });
});
