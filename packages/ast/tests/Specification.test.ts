import type { BinaryNode } from '../src/ast/Nodes';
import { CompositeSpecification, PredicateSpecification, Specs } from '../src/spec/Specification';

interface User {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const ageExpr = (op: BinaryNode['operator'], val: number): BinaryNode => ({
  type: 'binary',
  operator: op,
  left: { type: 'property', name: 'age' },
  right: { type: 'literal', value: val }
});

const activeExpr: BinaryNode = {
  type: 'binary',
  operator: '===',
  left: { type: 'property', name: 'active' },
  right: { type: 'literal', value: true }
};

describe('Specification Pattern', () => {
  describe('PredicateSpecification', () => {
    it('evaluates predicate against entity', () => {
      const spec = new PredicateSpecification<User>((user) => user.age >= 18, null);
      expect(spec.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
      expect(spec.test({ id: 2, name: 'Bob', age: 15, active: true })).toBe(false);
    });

    it('returns provided expression', () => {
      const expr = ageExpr('>=', 18);
      const spec = new PredicateSpecification<User>((user) => user.age >= 18, expr);
      expect(spec.toExpression()).toBe(expr);
    });

    it('returns null when no expression provided', () => {
      const spec = new PredicateSpecification<User>((user) => user.active, null);
      expect(spec.toExpression()).toBeNull();
    });
  });

  describe('CompositeSpecification', () => {
    describe('AND (&&)', () => {
      it('returns true when all specs pass', () => {
        const spec1 = new PredicateSpecification<User>((u) => u.age >= 18, null);
        const spec2 = new PredicateSpecification<User>((u) => u.active, null);
        const composite = new CompositeSpecification<User>('&&', [spec1, spec2]);
        expect(composite.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
      });

      it('returns false when any spec fails', () => {
        const spec1 = new PredicateSpecification<User>((u) => u.age >= 18, null);
        const spec2 = new PredicateSpecification<User>((u) => u.active, null);
        const composite = new CompositeSpecification<User>('&&', [spec1, spec2]);
        expect(composite.test({ id: 1, name: 'Bob', age: 20, active: false })).toBe(false);
      });

      it('produces LogicalNode with && operator', () => {
        const e1 = ageExpr('>=', 18);
        const spec1 = new PredicateSpecification<User>((u) => u.age >= 18, e1);
        const spec2 = new PredicateSpecification<User>((u) => u.active, activeExpr);
        const composite = new CompositeSpecification<User>('&&', [spec1, spec2]);

        const result = composite.toExpression();
        expect(result).not.toBeNull();
        expect(result?.type).toBe('logical');
        if (result?.type === 'logical') {
          const r = result;
          expect(r.operator).toBe('&&');
          expect(r.left).toBe(e1);
          expect(r.right).toBe(activeExpr);
        }
      });
    });

    describe('OR (||)', () => {
      it('returns true when any spec passes', () => {
        const spec1 = new PredicateSpecification<User>((u) => u.age >= 65, null);
        const spec2 = new PredicateSpecification<User>((u) => u.age < 18, null);
        const composite = new CompositeSpecification<User>('||', [spec1, spec2]);
        expect(composite.test({ id: 1, name: 'Senior', age: 70, active: true })).toBe(true);
        expect(composite.test({ id: 2, name: 'Minor', age: 10, active: true })).toBe(true);
      });

      it('returns false when all specs fail', () => {
        const spec1 = new PredicateSpecification<User>((u) => u.age >= 65, null);
        const spec2 = new PredicateSpecification<User>((u) => u.age < 18, null);
        const composite = new CompositeSpecification<User>('||', [spec1, spec2]);
        expect(composite.test({ id: 1, name: 'Adult', age: 30, active: true })).toBe(false);
      });

      it('produces LogicalNode with || operator', () => {
        const e1 = ageExpr('>=', 65);
        const e2 = ageExpr('<', 18);
        const spec1 = new PredicateSpecification<User>(() => true, e1);
        const spec2 = new PredicateSpecification<User>(() => true, e2);
        const composite = new CompositeSpecification<User>('||', [spec1, spec2]);

        const result = composite.toExpression();
        expect(result?.type).toBe('logical');
        if (result?.type === 'logical') {
          expect(result.operator).toBe('||');
        }
      });
    });

    describe('edge cases', () => {
      it('returns null for empty spec array', () => {
        const composite = new CompositeSpecification<User>('&&', []);
        expect(composite.toExpression()).toBeNull();
      });

      it('returns null when all child expressions are null', () => {
        const composite = new CompositeSpecification<User>('&&', [
          new PredicateSpecification<User>(() => true, null),
          new PredicateSpecification<User>(() => true, null)
        ]);
        expect(composite.toExpression()).toBeNull();
      });

      it('returns the single expression directly when only one is non-null', () => {
        const expr = ageExpr('>', 18);
        const composite = new CompositeSpecification<User>('&&', [
          new PredicateSpecification<User>(() => true, null),
          new PredicateSpecification<User>(() => true, expr)
        ]);
        // Only one non-null expression — returned as-is, not wrapped
        expect(composite.toExpression()).toBe(expr);
      });
    });
  });

  describe('Specs helper', () => {
    it('and() creates AND composite', () => {
      const spec1 = new PredicateSpecification<User>((u) => u.age >= 18, null);
      const spec2 = new PredicateSpecification<User>((u) => u.active, null);
      const result = Specs.and(spec1, spec2);
      expect(result).toBeInstanceOf(CompositeSpecification);
      expect(result.test({ id: 1, name: 'Alice', age: 20, active: true })).toBe(true);
      expect(result.test({ id: 2, name: 'Bob', age: 20, active: false })).toBe(false);
    });

    it('or() creates OR composite', () => {
      const spec1 = new PredicateSpecification<User>((u) => u.age >= 65, null);
      const spec2 = new PredicateSpecification<User>((u) => u.age < 18, null);
      const result = Specs.or(spec1, spec2);
      expect(result).toBeInstanceOf(CompositeSpecification);
      expect(result.test({ id: 1, name: 'Senior', age: 70, active: true })).toBe(true);
      expect(result.test({ id: 2, name: 'Minor', age: 10, active: true })).toBe(true);
      expect(result.test({ id: 3, name: 'Adult', age: 30, active: true })).toBe(false);
    });

    it('allows nesting AND and OR specs', () => {
      const isAdult = new PredicateSpecification<User>((u) => u.age >= 18, null);
      const isSenior = new PredicateSpecification<User>((u) => u.age >= 65, null);
      const isActive = new PredicateSpecification<User>((u) => u.active, null);

      const result = Specs.and(Specs.or(isAdult, isSenior), isActive);
      expect(result.test({ id: 1, name: 'Active Adult', age: 30, active: true })).toBe(true);
      expect(result.test({ id: 2, name: 'Inactive', age: 30, active: false })).toBe(false);
      expect(result.test({ id: 3, name: 'Minor', age: 15, active: true })).toBe(false);
    });
  });
});
