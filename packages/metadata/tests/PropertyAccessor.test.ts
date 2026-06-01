import { PropertyAccessMode } from '../src/PropertyAccessMode';
import { createPropertyAccessor, defaultPropertyAccessor } from '../src/PropertyAccessor';

class Order {
  // Backing field for total, setter enforces invariant
  private _total: number = 0;
  get total(): number {
    return this._total;
  }
  set total(v: number) {
    if (v < 0) throw new Error('Total cannot be negative');
    this._total = v;
  }

  // Plain public property
  name: string = '';

  // Aliased backing field
  private _status: string = 'pending';
  get status(): string {
    return this._status;
  }
  set status(v: string) {
    if (v === '') throw new Error('Status cannot be empty');
    this._status = v;
  }
}

describe('createPropertyAccessor — mode=Property (default)', () => {
  it('reads and writes through the public property', () => {
    const accessor = createPropertyAccessor<string>('name', undefined, PropertyAccessMode.Property);
    const order = new Order();

    accessor.set(order as unknown as object, 'Alice');
    expect(accessor.get(order as unknown as object)).toBe('Alice');
  });

  it('constructionSet also goes through the public property', () => {
    const accessor = createPropertyAccessor<string>('name', undefined, PropertyAccessMode.Property);
    const order = new Order();
    accessor.constructionSet(order as unknown as object, 'Bob');
    expect(order.name).toBe('Bob');
  });
});

describe('createPropertyAccessor — mode=Field', () => {
  it('reads and writes via the backing field, bypassing setter invariant', () => {
    const accessor = createPropertyAccessor<number>('total', '_total', PropertyAccessMode.Field);
    const order = new Order();

    // Setter would throw for -1, but Field mode bypasses it
    expect(() => {
      accessor.set(order as unknown as object, -1);
    }).not.toThrow();
    expect(accessor.get(order as unknown as object)).toBe(-1);
  });

  it('constructionSet also bypasses setter', () => {
    const accessor = createPropertyAccessor<number>('total', '_total', PropertyAccessMode.Field);
    const order = new Order();
    accessor.constructionSet(order as unknown as object, 99);
    // Read via backing field directly
    expect((order as unknown as Record<string, unknown>)['_total']).toBe(99);
  });

  it('uses _propertyName convention when fieldName is undefined', () => {
    const accessor = createPropertyAccessor<number>('total', undefined, PropertyAccessMode.Field);
    const order = new Order();
    accessor.set(order as unknown as object, 42);
    expect((order as unknown as Record<string, unknown>)['_total']).toBe(42);
  });
});

describe('createPropertyAccessor — mode=FieldDuringConstruction', () => {
  it('constructionSet writes to the backing field (bypassing setter)', () => {
    const accessor = createPropertyAccessor<string>(
      'status',
      '_status',
      PropertyAccessMode.FieldDuringConstruction
    );
    const order = new Order();

    // setter would throw for '' but constructionSet writes to field directly
    expect(() => {
      accessor.constructionSet(order as unknown as object, '');
    }).not.toThrow();
    expect((order as unknown as Record<string, unknown>)['_status']).toBe('');
  });

  it('get reads via the public getter', () => {
    const accessor = createPropertyAccessor<string>(
      'status',
      '_status',
      PropertyAccessMode.FieldDuringConstruction
    );
    const order = new Order();
    // Bypass setter to set field
    (order as unknown as Record<string, unknown>)['_status'] = 'shipped';
    expect(accessor.get(order as unknown as object)).toBe('shipped');
  });

  it('set (post-construction) goes through the public setter', () => {
    const accessor = createPropertyAccessor<string>(
      'status',
      '_status',
      PropertyAccessMode.FieldDuringConstruction
    );
    const order = new Order();

    // set via public setter — empty string should throw
    expect(() => {
      accessor.set(order as unknown as object, '');
    }).toThrow('Status cannot be empty');
  });
});

describe('defaultPropertyAccessor', () => {
  it('is equivalent to Property mode', () => {
    const accessor = defaultPropertyAccessor<string>('name');
    const order = new Order();
    accessor.set(order as unknown as object, 'test');
    expect(accessor.get(order as unknown as object)).toBe('test');
  });
});
