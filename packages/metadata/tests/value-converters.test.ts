import {
  BoolToZeroOneConverter,
  Column,
  createEnumToStringConverter,
  DateOnlyToStringConverter,
  Entity,
  EnumToNumberConverter,
  EnumToStringConverter,
  MetadataStorage,
  ValueComparer,
  ValueConverter
} from '../src';

describe('ValueConverter', () => {
  it('stores and applies toProvider / fromProvider', () => {
    const conv = new ValueConverter<boolean, number>(
      (v) => (v ? 1 : 0),
      (v) => v !== 0
    );
    expect(conv.toProvider(true)).toBe(1);
    expect(conv.toProvider(false)).toBe(0);
    expect(conv.fromProvider(1)).toBe(true);
    expect(conv.fromProvider(0)).toBe(false);
  });
});

describe('ValueComparer', () => {
  it('stores and applies equals / hash / snapshot', () => {
    const cmp = new ValueComparer<string[]>(
      (a, b) => a.join(',') === b.join(','),
      (v) => v.reduce((h, s) => h ^ s.charCodeAt(0), 0),
      (v) => [...v]
    );
    expect(cmp.equals(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(cmp.equals(['a'], ['b'])).toBe(false);
    const snap = cmp.snapshot(['x', 'y']);
    expect(snap).toEqual(['x', 'y']);
    expect(snap).not.toBe(['x', 'y']); // new array
  });
});

describe('BoolToZeroOneConverter', () => {
  it('converts true → 1, false → 0', () => {
    expect(BoolToZeroOneConverter.toProvider(true)).toBe(1);
    expect(BoolToZeroOneConverter.toProvider(false)).toBe(0);
  });

  it('converts 1 → true, 0 → false', () => {
    expect(BoolToZeroOneConverter.fromProvider(1)).toBe(true);
    expect(BoolToZeroOneConverter.fromProvider(0)).toBe(false);
  });
});

describe('EnumToStringConverter', () => {
  it('converts values using String()', () => {
    expect(EnumToStringConverter.toProvider('admin')).toBe('admin');
    expect(EnumToStringConverter.fromProvider('admin')).toBe('admin');
  });

  describe('createEnumToStringConverter', () => {
    enum Role {
      Admin = 'ADMIN',
      User = 'USER'
    }

    it('maps enum value to string and back', () => {
      const conv = createEnumToStringConverter(Role);
      expect(conv.toProvider(Role.Admin)).toBe('ADMIN');
      expect(conv.fromProvider('ADMIN')).toBe('ADMIN');
    });
  });
});

describe('EnumToNumberConverter', () => {
  it('converts number enum to number and back', () => {
    expect(EnumToNumberConverter.toProvider(42)).toBe(42);
    expect(EnumToNumberConverter.fromProvider(42)).toBe(42);
  });
});

describe('DateOnlyToStringConverter', () => {
  it('converts Date to YYYY-MM-DD string', () => {
    const d = new Date('2024-03-15T00:00:00.000Z');
    const str = DateOnlyToStringConverter.toProvider(d);
    expect(str).toBe('2024-03-15');
  });

  it('converts YYYY-MM-DD string back to Date', () => {
    const d = DateOnlyToStringConverter.fromProvider('2024-03-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toContain('2024-03-15');
  });
});

describe('@Column with converter in ColumnMetadata', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  it('stores converter on ColumnMetadata', () => {
    const conv = new ValueConverter<boolean, number>(
      (v) => (v ? 1 : 0),
      (v) => v !== 0
    );

    @Entity()
    class TestEntity {
      @Column({ type: 'INTEGER' })
      active!: boolean;
    }

    // Manually attach converter (decorator doesn't support it yet — that's PropertyBuilder's job)
    const meta = MetadataStorage.getEntity(TestEntity);
    const col = meta?.columns.find((c) => c.propertyName === 'active');
    expect(col).toBeDefined();

    // Simulate what PropertyBuilder.hasConversion does
    col!.converter = conv;

    expect(col!.converter?.toProvider(true)).toBe(1);
    expect(col!.converter?.fromProvider(0)).toBe(false);
  });
});
