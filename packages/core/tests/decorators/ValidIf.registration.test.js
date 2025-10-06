'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const ValidIf_1 = require('../../src/decorators/ValidIf');
class Customer {}
describe('ValidIf registration (Stage-3 initializer)', () => {
  test('stores rule in Reflect metadata on class', () => {
    // Simulate decorator application on field using Stage-3 context
    (0, ValidIf_1.ValidIfOf)((c) => !!c.email && c.email.includes('@'))(undefined, {
      kind: 'field',
      name: 'email',
      addInitializer: (fn) => fn.call(Customer.prototype)
    });
    const rules = Reflect.getOwnMetadata('orm:validations', Customer) || [];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.propertyName === 'email')).toBe(true);
  });
});
//# sourceMappingURL=ValidIf.registration.test.js.map
