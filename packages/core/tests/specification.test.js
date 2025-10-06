'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const PredicateParser_1 = require('../src/query/PredicateParser');
const Specification_1 = require('../src/query/spec/Specification');
describe('Specification', () => {
  it('PredicateSpecification test() uses predicate', () => {
    const spec = new Specification_1.PredicateSpecification((x) => x.n > 5, null);
    expect(spec.test({ n: 6 })).toBe(true);
    expect(spec.test({ n: 4 })).toBe(false);
  });
  it('Composite AND combines expressions', () => {
    const parser = new PredicateParser_1.PredicateParser();
    const s1 = new Specification_1.PredicateSpecification(
      (x) => x.a === 1,
      parser.parse((x) => x.a === 1)
    );
    const s2 = new Specification_1.PredicateSpecification(
      (x) => x.b > 0,
      parser.parse((x) => x.b > 0)
    );
    const andSpec = Specification_1.Specs.and(s1, s2);
    const expr = andSpec.toExpression();
    expect(expr).toBeTruthy();
    expect(andSpec.test({ a: 1, b: 2 })).toBe(true);
  });
});
//# sourceMappingURL=specification.test.js.map
