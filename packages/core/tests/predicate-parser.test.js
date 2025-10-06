'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const PredicateParser_1 = require('../src/query/PredicateParser');
describe('PredicateParser', () => {
  it('parses simple equality', () => {
    const p = new PredicateParser_1.PredicateParser();
    const ast = p.parse((x) => x.id === 1);
    expect(ast).toBeTruthy();
  });
  it('parses conjunction with >= and >', () => {
    const p = new PredicateParser_1.PredicateParser();
    const ast = p.parse((x) => x.price >= 10 && x.stock > 0);
    expect(ast).toBeTruthy();
  });
  it('returns null for variable comparison (fallback)', () => {
    const max = 10;
    const p = new PredicateParser_1.PredicateParser();
    const ast = p.parse((x) => x.price <= max);
    expect(ast).toBeNull();
  });
});
//# sourceMappingURL=predicate-parser.test.js.map
