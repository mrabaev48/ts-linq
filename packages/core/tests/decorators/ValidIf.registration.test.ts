import 'reflect-metadata';
import { ValidIfOf } from '../../src/decorators/ValidIf';

class Customer {
  email!: string;
}

describe('ValidIf registration (Stage-3 initializer)', () => {
  test('stores rule in Reflect metadata on class', () => {
    // Simulate decorator application on field using Stage-3 context
    ValidIfOf<Customer>((c) => !!c.email && c.email.includes('@'))(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'email',
        addInitializer: (fn: (this: unknown) => void) => fn.call(Customer.prototype)
      } as any
    );

    const rules =
      (Reflect.getOwnMetadata('orm:validations', Customer) as Array<{
        propertyName: string;
        predicate: (e: unknown) => boolean;
        message?: string;
      }>) || [];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.propertyName === 'email')).toBe(true);
  });
});
