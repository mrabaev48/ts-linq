import {
  CompositeSpecification,
  PredicateSpecification,
  Specs,
  type Specification
} from '../src/spec/Specification';
import { LogicalOperator, ComparisonOperator } from '../src/ast/Nodes';
import type { BinaryExpressionNode } from '../src/ast/Nodes';

interface User {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

describe('Specification Pattern', () => {
  describe('PredicateSpecification', () => {
    it('should evaluate predicate against entity', () => {
      const spec = new PredicateSpecification<User>(
        (user) => user.age >= 18,
        null
      );

      expect(spec.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
      expect(spec.test({ id: 2, name: 'Bob', age: 15, active: true })).toBe(false);
    });

    it('should return provided expression', () => {
      const expr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'Literal', value: 18 }
      };

      const spec = new PredicateSpecification<User>(
        (user) => user.age >= 18,
        expr
      );

      expect(spec.toExpression()).toBe(expr);
    });

    it('should return null when no expression provided', () => {
      const spec = new PredicateSpecification<User>(
        (user) => user.active,
        null
      );

      expect(spec.toExpression()).toBeNull();
    });

    it('should handle complex predicates', () => {
      const spec = new PredicateSpecification<User>(
        (user) => user.active && user.age > 21,
        null
      );

      expect(spec.test({ id: 1, name: 'Alice', age: 25, active: true })).toBe(true);
      expect(spec.test({ id: 2, name: 'Bob', age: 20, active: true })).toBe(false);
      expect(spec.test({ id: 3, name: 'Charlie', age: 25, active: false })).toBe(false);
    });
  });

  describe('CompositeSpecification', () => {
    describe('AND operator', () => {
      it('should return true when all specs pass', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 18,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.active,
          null
        );

        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          [spec1, spec2]
        );

        expect(composite.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
      });

      it('should return false when any spec fails', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 18,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.active,
          null
        );

        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          [spec1, spec2]
        );

        expect(composite.test({ id: 1, name: 'Bob', age: 20, active: false })).toBe(false);
        expect(composite.test({ id: 2, name: 'Charlie', age: 15, active: true })).toBe(false);
      });

      it('should combine expressions with AND', () => {
        const expr1: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['age'] },
          operator: ComparisonOperator.Gte,
          right: { type: 'Literal', value: 18 }
        };

        const expr2: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['active'] },
          operator: ComparisonOperator.Eq,
          right: { type: 'Literal', value: true }
        };

        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 18,
          expr1
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.active,
          expr2
        );

        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          [spec1, spec2]
        );

        const result = composite.toExpression();
        expect(result).not.toBeNull();
        expect(result?.type).toBe('LogicalExpression');
        if (result && result.type === 'LogicalExpression') {
          expect(result.operator).toBe('AND');
          expect(result.expressions).toHaveLength(2);
        }
      });
    });

    describe('OR operator', () => {
      it('should return true when any spec passes', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 65,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.age < 18,
          null
        );

        const composite = new CompositeSpecification<User>(
          LogicalOperator.Or,
          [spec1, spec2]
        );

        expect(composite.test({ id: 1, name: 'Senior', age: 70, active: true })).toBe(true);
        expect(composite.test({ id: 2, name: 'Minor', age: 10, active: true })).toBe(true);
      });

      it('should return false when all specs fail', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 65,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.age < 18,
          null
        );

        const composite = new CompositeSpecification<User>(
          LogicalOperator.Or,
          [spec1, spec2]
        );

        expect(composite.test({ id: 1, name: 'Adult', age: 30, active: true })).toBe(false);
      });

      it('should combine expressions with OR', () => {
        const expr1: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['age'] },
          operator: ComparisonOperator.Gte,
          right: { type: 'Literal', value: 65 }
        };

        const expr2: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['age'] },
          operator: ComparisonOperator.Lt,
          right: { type: 'Literal', value: 18 }
        };

        const spec1 = new PredicateSpecification<User>(() => true, expr1);
        const spec2 = new PredicateSpecification<User>(() => true, expr2);

        const composite = new CompositeSpecification<User>(
          LogicalOperator.Or,
          [spec1, spec2]
        );

        const result = composite.toExpression();
        expect(result).not.toBeNull();
        expect(result?.type).toBe('LogicalExpression');
        if (result && result.type === 'LogicalExpression') {
          expect(result.operator).toBe('OR');
          expect(result.expressions).toHaveLength(2);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty spec array', () => {
        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          []
        );

        expect(composite.toExpression()).toBeNull();
      });

      it('should filter out null expressions', () => {
        const spec1 = new PredicateSpecification<User>(() => true, null);
        
        const binaryExpr: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['age'] },
          operator: ComparisonOperator.Gt,
          right: { type: 'Literal', value: 18 }
        };
        
        const spec2 = new PredicateSpecification<User>(() => true, binaryExpr);

        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          [spec1, spec2]
        );

        const result = composite.toExpression();
        expect(result).not.toBeNull();
        if (result && result.type === 'LogicalExpression') {
          expect(result.expressions).toHaveLength(1);
        }
      });

      it('should return null when all child expressions are null', () => {
        const spec1 = new PredicateSpecification<User>(() => true, null);
        const spec2 = new PredicateSpecification<User>(() => true, null);

        const composite = new CompositeSpecification<User>(
          LogicalOperator.And,
          [spec1, spec2]
        );

        expect(composite.toExpression()).toBeNull();
      });
    });
  });

  describe('Specs helper', () => {
    describe('and()', () => {
      it('should create AND composite specification', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 18,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.active,
          null
        );

        const result = Specs.and(spec1, spec2);

        expect(result).toBeInstanceOf(CompositeSpecification);
        expect(result.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
        expect(result.test({ id: 2, name: 'Bob', age: 20, active: false })).toBe(false);
      });

      it('should accept variable number of specs', () => {
        const spec1 = new PredicateSpecification<User>((user) => user.age >= 18, null);
        const spec2 = new PredicateSpecification<User>((user) => user.active, null);
        const spec3 = new PredicateSpecification<User>((user) => user.name.length > 3, null);

        const result = Specs.and(spec1, spec2, spec3);

        expect(result.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
        expect(result.test({ id: 2, name: 'Bob', age: 20, active: true })).toBe(false);
      });
    });

    describe('or()', () => {
      it('should create OR composite specification', () => {
        const spec1 = new PredicateSpecification<User>(
          (user) => user.age >= 65,
          null
        );
        const spec2 = new PredicateSpecification<User>(
          (user) => user.age < 18,
          null
        );

        const result = Specs.or(spec1, spec2);

        expect(result).toBeInstanceOf(CompositeSpecification);
        expect(result.test({ id: 1, name: 'Senior', age: 70, active: true })).toBe(true);
        expect(result.test({ id: 2, name: 'Minor', age: 10, active: true })).toBe(true);
        expect(result.test({ id: 3, name: 'Adult', age: 30, active: true })).toBe(false);
      });

      it('should accept variable number of specs', () => {
        const spec1 = new PredicateSpecification<User>((user) => user.age < 18, null);
        const spec2 = new PredicateSpecification<User>((user) => user.age > 65, null);
        const spec3 = new PredicateSpecification<User>((user) => !user.active, null);

        const result = Specs.or(spec1, spec2, spec3);

        expect(result.test({ id: 1, name: 'Minor', age: 10, active: true })).toBe(true);
        expect(result.test({ id: 2, name: 'Senior', age: 70, active: true })).toBe(true);
        expect(result.test({ id: 3, name: 'Inactive', age: 30, active: false })).toBe(true);
        expect(result.test({ id: 4, name: 'Active Adult', age: 30, active: true })).toBe(false);
      });
    });

    describe('composition', () => {
      it('should allow nesting AND and OR specs', () => {
        const isAdult = new PredicateSpecification<User>((user) => user.age >= 18, null);
        const isSenior = new PredicateSpecification<User>((user) => user.age >= 65, null);
        const isActive = new PredicateSpecification<User>((user) => user.active, null);

        const result = Specs.and(
          Specs.or(isAdult, isSenior),
          isActive
        );

        expect(result.test({ id: 1, name: 'Active Adult', age: 30, active: true })).toBe(true);
        expect(result.test({ id: 2, name: 'Inactive Adult', age: 30, active: false })).toBe(false);
        expect(result.test({ id: 3, name: 'Active Minor', age: 15, active: true })).toBe(false);
      });
    });
  });
});
