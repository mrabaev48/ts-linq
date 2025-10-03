import 'reflect-metadata';
import { PredicateParser, PredicateSpecification, Specs } from '../src';

describe('Specification', () => {
  it('PredicateSpecification test() uses predicate', () => {
    const spec: PredicateSpecification<{ n: number }> = new PredicateSpecification<{ n: number }>(
      (x) => x.n > 5,
      null
    );
    expect(spec.test({ n: 6 })).toBe(true);
    expect(spec.test({ n: 4 })).toBe(false);
  });
  it('Composite AND combines expressions', () => {
    type AB = { a: number; b: number };
    const parser: PredicateParser<AB> = new PredicateParser<AB>();
    const s1: PredicateSpecification<AB> = new PredicateSpecification<AB>(
      (x) => x.a === 1,
      parser.parse((x: AB) => x.a === 1)
    );
    const s2: PredicateSpecification<AB> = new PredicateSpecification<AB>(
      (x) => x.b > 0,
      parser.parse((x: AB) => x.b > 0)
    );
    const andSpec = Specs.and<AB>(s1, s2);
    const expr = andSpec.toExpression();
    expect(expr).toBeTruthy();
    expect(andSpec.test({ a: 1, b: 2 })).toBe(true);
  });
});
