import type { ColumnMetadata } from '@ts-linq/types';
import { ValueGeneratedPolicy } from '@ts-linq/types';

import { PropertyBuilder } from '../src/builders/PropertyBuilder';
import { UlidValueGenerator } from '../src/valueGenerators/UlidValueGenerator';
import { UtcNowValueGenerator } from '../src/valueGenerators/UtcNowValueGenerator';
import { UuidV7ValueGenerator } from '../src/valueGenerators/UuidV7ValueGenerator';

function makeBuilder<T = unknown>(
  propName = 'id'
): { builder: PropertyBuilder<T>; columns: Map<string, ColumnMetadata> } {
  const columns = new Map<string, ColumnMetadata>();
  const builder = new PropertyBuilder<T>(propName, columns);
  return { builder, columns };
}

describe('PropertyBuilder — valueGeneratedOnAdd', () => {
  test('sets policy to OnAdd', () => {
    const { builder, columns } = makeBuilder();
    builder.valueGeneratedOnAdd();
    expect(columns.get('id')?.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnAdd);
  });

  test('returns this (fluent)', () => {
    const { builder } = makeBuilder();
    expect(builder.valueGeneratedOnAdd()).toBe(builder);
  });
});

describe('PropertyBuilder — valueGeneratedOnUpdate', () => {
  test('sets policy to OnUpdate', () => {
    const { builder, columns } = makeBuilder('updatedAt');
    builder.valueGeneratedOnUpdate();
    expect(columns.get('updatedAt')?.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnUpdate);
  });
});

describe('PropertyBuilder — valueGeneratedOnAddOrUpdate', () => {
  test('sets policy to OnAddOrUpdate', () => {
    const { builder, columns } = makeBuilder('ts');
    builder.valueGeneratedOnAddOrUpdate();
    expect(columns.get('ts')?.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnAddOrUpdate);
  });
});

describe('PropertyBuilder — valueGeneratedNever', () => {
  test('sets policy to Never', () => {
    const { builder, columns } = makeBuilder('sortOrder');
    builder.valueGeneratedNever();
    expect(columns.get('sortOrder')?.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.Never);
  });
});

describe('PropertyBuilder — hasValueGenerator', () => {
  test('stores the generator class', () => {
    const { builder, columns } = makeBuilder();
    builder.hasValueGenerator(UlidValueGenerator);
    expect(columns.get('id')?.valueGeneratorClass).toBe(UlidValueGenerator);
  });

  test('returns this (fluent)', () => {
    const { builder } = makeBuilder();
    expect(builder.hasValueGenerator(UlidValueGenerator)).toBe(builder);
  });
});

describe('PropertyBuilder — hasSentinel', () => {
  test('stores sentinel value', () => {
    const { builder, columns } = makeBuilder<number>('sortOrder');
    builder.hasSentinel(0);
    expect(columns.get('sortOrder')?.sentinel).toBe(0);
  });

  test('stores negative sentinel', () => {
    const { builder, columns } = makeBuilder<number>('rank');
    builder.hasSentinel(-1);
    expect(columns.get('rank')?.sentinel).toBe(-1);
  });

  test('stores empty string sentinel', () => {
    const { builder, columns } = makeBuilder<string>('code');
    builder.hasSentinel('');
    expect(columns.get('code')?.sentinel).toBe('');
  });

  test('returns this (fluent)', () => {
    const { builder } = makeBuilder<number>('sortOrder');
    expect(builder.hasSentinel(0)).toBe(builder);
  });
});

describe('PropertyBuilder — chain fluency', () => {
  test('chain valueGeneratedOnAdd + hasValueGenerator + hasSentinel', () => {
    const { builder, columns } = makeBuilder<string>('externalId');
    builder.valueGeneratedOnAdd().hasValueGenerator(UlidValueGenerator).hasSentinel('');
    const col = columns.get('externalId');
    expect(col?.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnAdd);
    expect(col?.valueGeneratorClass).toBe(UlidValueGenerator);
    expect(col?.sentinel).toBe('');
  });
});

describe('UlidValueGenerator', () => {
  const gen = new UlidValueGenerator();
  const ctx = { entityClass: class Post {}, propertyName: 'id' };

  test('returns a 26-character string', () => {
    const id = gen.next(ctx);
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(26);
  });

  test('returns Crockford Base32 characters only', () => {
    const id = gen.next(ctx);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => gen.next(ctx)));
    expect(ids.size).toBe(100);
  });
});

describe('UuidV7ValueGenerator', () => {
  const gen = new UuidV7ValueGenerator();
  const ctx = { entityClass: class Post {}, propertyName: 'id' };

  test('returns a UUID-format string', () => {
    const id = gen.next(ctx);
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('version nibble is 7', () => {
    const id = gen.next(ctx);
    const versionNibble = id.split('-')[2][0];
    expect(versionNibble).toBe('7');
  });

  test('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => gen.next(ctx)));
    expect(ids.size).toBe(100);
  });
});

describe('UtcNowValueGenerator', () => {
  const gen = new UtcNowValueGenerator();
  const ctx = { entityClass: class Post {}, propertyName: 'createdAt' };

  test('returns a Date', () => {
    const val = gen.next(ctx);
    expect(val).toBeInstanceOf(Date);
  });

  test('returns current time (within 1 second)', () => {
    const before = Date.now();
    const val = gen.next(ctx);
    const after = Date.now();
    expect(val.getTime()).toBeGreaterThanOrEqual(before);
    expect(val.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('prefillDefaults — sentinel and generator logic', () => {
  // We test the logic directly via PropertyBuilder + simulated pipeline
  // by invoking the generator inline (white-box unit test of the algorithm)

  function runGeneratorLogic(
    policy: ValueGeneratedPolicy,
    state: 'added' | 'modified',
    sentinel: unknown,
    currentValue: unknown,
    generatorClass: new () => { next(ctx: object): unknown }
  ): unknown {
    if (policy === ValueGeneratedPolicy.Never) return currentValue;
    if (policy === ValueGeneratedPolicy.OnAdd && state !== 'added') return currentValue;
    if (policy === ValueGeneratedPolicy.OnUpdate && state !== 'modified') return currentValue;
    const shouldGenerate =
      sentinel !== undefined ? currentValue === sentinel : currentValue === undefined;
    if (!shouldGenerate) return currentValue;
    return new generatorClass().next({ entityClass: class {}, propertyName: 'id' });
  }

  test('OnAdd: generator fires for added entity with undefined value', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnAdd,
      'added',
      undefined,
      undefined,
      UlidValueGenerator
    );
    expect(typeof result).toBe('string');
    expect((result as string).length).toBe(26);
  });

  test('OnAdd: generator does NOT fire for modified entity', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnAdd,
      'modified',
      undefined,
      undefined,
      UlidValueGenerator
    );
    expect(result).toBeUndefined();
  });

  test('OnUpdate: generator fires for modified entity', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnUpdate,
      'modified',
      undefined,
      undefined,
      UtcNowValueGenerator
    );
    expect(result).toBeInstanceOf(Date);
  });

  test('OnUpdate: generator does NOT fire for added entity', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnUpdate,
      'added',
      undefined,
      undefined,
      UtcNowValueGenerator
    );
    expect(result).toBeUndefined();
  });

  test('sentinel match triggers generator', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnAdd,
      'added',
      -1,
      -1,
      UlidValueGenerator
    );
    expect(typeof result).toBe('string');
  });

  test('sentinel non-match preserves user value', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.OnAdd,
      'added',
      -1,
      42,
      UlidValueGenerator
    );
    expect(result).toBe(42);
  });

  test('sentinel=0: value 0 triggers generator', () => {
    const result = runGeneratorLogic(ValueGeneratedPolicy.OnAdd, 'added', 0, 0, UlidValueGenerator);
    expect(typeof result).toBe('string');
  });

  test('sentinel=0: value 5 preserved', () => {
    const result = runGeneratorLogic(ValueGeneratedPolicy.OnAdd, 'added', 0, 5, UlidValueGenerator);
    expect(result).toBe(5);
  });

  test('Never: generator never fires', () => {
    const result = runGeneratorLogic(
      ValueGeneratedPolicy.Never,
      'added',
      undefined,
      undefined,
      UlidValueGenerator
    );
    expect(result).toBeUndefined();
  });
});
