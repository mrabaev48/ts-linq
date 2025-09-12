import 'reflect-metadata';
import { PredicateParser } from '../src/query/PredicateParser';
import { PredicateSpecification, Specs } from '../src/query/spec/Specification';

describe('Specification', () => {
  it('PredicateSpecification test() uses predicate', () => {
    const spec = new PredicateSpecification<{ n: number }>((x) => x.n > 5, null);
    expect(spec.test({ n: 6 })).toBe(true);
    expect(spec.test({ n: 4 })).toBe(false);
  });
  it('Composite AND combines expressions', () => {
    type AB = { a?: number; b?: number };
    const parser = new PredicateParser<AB>();
    const s1 = new PredicateSpecification<AB>((x) => (x.a as number) === 1, parser.parse((x: any) => x.a === 1));
    const s2 = new PredicateSpecification<AB>((x) => (x.b as number) > 0, parser.parse((x: any) => x.b > 0));
    const andSpec = Specs.and<AB>(s1, s2);
    const expr = andSpec.toExpression();
    expect(expr).toBeTruthy();
    expect(andSpec.test({ a: 1, b: 2 })).toBe(true);
  });
});
