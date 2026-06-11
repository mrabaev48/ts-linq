/**
 * Tests for the extractKey() helper — exercised via the public Queryable API.
 *
 * extractKey() converts a keyof-T string/symbol OR a single-property lambda into
 * a plain string column name.  Multi-property access (nested paths, branching
 * expressions) must throw a descriptive error instead of silently returning the
 * wrong column.
 *
 * Because extractKey() is an internal function, we test it through the public
 * Queryable methods (orderBy, orderByDescending, thenBy, thenByDescending,
 * innerJoinOn, leftJoinOn).
 *
 * Lambdas that exceed the single-property contract are cast via `unknown` so
 * TypeScript lets them through — the point is to verify the *runtime* guard.
 */
import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import { SelectorExtractionError, type SqlDialect, type SqlParameter } from '@ts-linq/types';

import { extractKey } from '../src/extractKey';
import { Queryable } from '../src/Queryable';

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

class User {
  id!: number;
  name!: string;
  age!: number;
}

class Post {
  id!: number;
  userId!: number;
}

class TestDialect implements SqlDialect {
  public buildSelect<T>(entityClass: new () => T): {
    query: string;
    parameters: readonly SqlParameter[];
  } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    return { query: `SELECT * FROM ${meta.tableName}`, parameters: [] };
  }
  public quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

class TestProvider extends DatabaseProvider {
  private readonly dialect = new TestDialect();
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return this.dialect;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  public override async beginTransaction(): Promise<void> {}
  public override async commitTransaction(): Promise<void> {}
  public override async rollbackTransaction(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
  public constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

type UserSelector = (entity: User) => User[keyof User];

function makeQueryable(): Queryable<User> {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'users');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
  MetadataStorage.addColumn(User, { propertyName: 'age', columnName: 'age', type: 'INTEGER' });
  return new Queryable(User, QueryContext.fromProvider(new TestProvider()));
}

function makeJoinQueryable(): Queryable<User> {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'users');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
  MetadataStorage.addColumn(User, { propertyName: 'age', columnName: 'age', type: 'INTEGER' });
  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addColumn(Post, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addPrimaryKey(Post, 'id');
  MetadataStorage.addColumn(Post, {
    propertyName: 'userId',
    columnName: 'user_id',
    type: 'INTEGER'
  });
  return new Queryable(User, QueryContext.fromProvider(new TestProvider()));
}

// Helper: build a "nested path" lambda that accesses two properties at runtime.
// We bypass static types with `unknown` because TypeScript (correctly) rejects
// these at compile time — the test is about the *runtime* guard.
function nestedLambda(prop1: string, prop2: string): UserSelector {
  return ((u: Record<string, Record<string, unknown>>) =>
    u[prop1][prop2]) as unknown as UserSelector;
}

// ---------------------------------------------------------------------------
// Single-property selectors — valid
// ---------------------------------------------------------------------------

describe('extractKey — single-property selectors (valid)', () => {
  test('string key is accepted', () => {
    expect(() => makeQueryable().orderBy('name')).not.toThrow();
  });

  test('single-property lambda — orderBy', () => {
    expect(() => makeQueryable().orderBy((u) => u.name)).not.toThrow();
  });

  test('single-property lambda — orderByDescending', () => {
    expect(() => makeQueryable().orderByDescending((u) => u.age)).not.toThrow();
  });

  test('single-property lambda — thenBy', () => {
    expect(() =>
      makeQueryable()
        .orderBy('name')
        .thenBy((u) => u.age)
    ).not.toThrow();
  });

  test('single-property lambda — thenByDescending', () => {
    expect(() =>
      makeQueryable()
        .orderBy('name')
        .thenByDescending((u) => u.id)
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Nested-path selectors — must throw
// ---------------------------------------------------------------------------

describe('extractKey — nested-path selectors (must throw)', () => {
  const SINGLE_PROP_MSG = /Only single-property selectors are supported/;

  test('orderBy with 2-level nested lambda throws', () => {
    expect(() => makeQueryable().orderBy(nestedLambda('profile', 'city'))).toThrow(SINGLE_PROP_MSG);
  });

  test('orderByDescending with nested lambda throws', () => {
    expect(() => makeQueryable().orderByDescending(nestedLambda('address', 'zip'))).toThrow(
      SINGLE_PROP_MSG
    );
  });

  test('thenBy with nested lambda throws', () => {
    expect(() => makeQueryable().orderBy('name').thenBy(nestedLambda('meta', 'score'))).toThrow(
      SINGLE_PROP_MSG
    );
  });

  test('thenByDescending with nested lambda throws', () => {
    expect(() =>
      makeQueryable().orderBy('name').thenByDescending(nestedLambda('stats', 'rank'))
    ).toThrow(SINGLE_PROP_MSG);
  });

  test('error message lists the accessed properties', () => {
    expect(() => makeQueryable().orderBy(nestedLambda('profile', 'city'))).toThrow(/profile.*city/);
  });

  test('error message suggests using a string key', () => {
    expect(() => makeQueryable().orderBy(nestedLambda('profile', 'city'))).toThrow(/string key/i);
  });

  test('error message includes the dotted path suggestion', () => {
    expect(() => makeQueryable().orderBy(nestedLambda('profile', 'city'))).toThrow('profile.city');
  });
});

// ---------------------------------------------------------------------------
// Branching selectors — must throw (proxy is truthy → always takes then-branch)
// ---------------------------------------------------------------------------

describe('extractKey — branching selectors (must throw)', () => {
  test('ternary lambda accessing 2 properties throws', () => {
    // Proxy is truthy: accesses `cond` (truthy path) then `thenProp` → 2 accesses
    const branchingLambda = ((u: Record<string, unknown>) =>
      u['cond'] ? u['thenProp'] : u['elseProp']) as unknown as UserSelector;

    expect(() => makeQueryable().orderBy(branchingLambda)).toThrow(
      /Only single-property selectors are supported/
    );
  });
});

// ---------------------------------------------------------------------------
// Non-property selectors — must throw "Could not extract property name"
// ---------------------------------------------------------------------------

describe('extractKey — non-property selectors (must throw)', () => {
  test('lambda returning a literal throws "Could not extract property name"', () => {
    const literal = (() => 42) as unknown as UserSelector;
    expect(() => makeQueryable().orderBy(literal)).toThrow(
      /Could not extract property name from selector lambda/
    );
  });
});

// ---------------------------------------------------------------------------
// Join methods forward extractKey correctly
// ---------------------------------------------------------------------------

describe('extractKey — join methods', () => {
  test('innerJoinOn with valid string keys does not throw', () => {
    expect(() => makeJoinQueryable().innerJoinOn(Post, 'id', 'userId')).not.toThrow();
  });

  test('innerJoinOn with single-property lambda on left key does not throw', () => {
    expect(() => makeJoinQueryable().innerJoinOn(Post, (u) => u.id, 'userId')).not.toThrow();
  });

  test('innerJoinOn with nested lambda on left key throws', () => {
    expect(() =>
      makeJoinQueryable().innerJoinOn(Post, nestedLambda('profile', 'id'), 'userId')
    ).toThrow(/Only single-property selectors are supported/);
  });

  test('leftJoinOn with nested lambda on left key throws', () => {
    expect(() =>
      makeJoinQueryable().leftJoinOn(Post, nestedLambda('nested', 'id'), 'userId')
    ).toThrow(/Only single-property selectors are supported/);
  });
});

// ---------------------------------------------------------------------------
// Shared helper: direct unit coverage of the single, unified extractor.
// Both `extractKey` (ordering/join/include) and `SetPropertyCalls.setProperty`
// now route through this one function with one consistent, typed error model.
// ---------------------------------------------------------------------------

describe('extractKey — shared helper (direct)', () => {
  test('string key passes through unchanged', () => {
    expect(extractKey<User>('name')).toBe('name');
  });

  test('single-property lambda returns the property name', () => {
    expect(extractKey<User>((u) => u.age)).toBe('age');
  });

  test('multi-property lambda throws SelectorExtractionError with the unified message', () => {
    const nested = ((u: Record<string, Record<string, unknown>>) =>
      u['profile']['city']) as unknown as (u: User) => unknown;
    expect(() => extractKey<User>(nested)).toThrow(SelectorExtractionError);
    expect(() => extractKey<User>(nested)).toThrow(/Only single-property selectors are supported/);
  });

  test('zero-property lambda throws SelectorExtractionError', () => {
    const literal = (() => 42) as unknown as (u: User) => unknown;
    expect(() => extractKey<User>(literal)).toThrow(SelectorExtractionError);
    expect(() => extractKey<User>(literal)).toThrow(
      /Could not extract property name from selector lambda/
    );
  });

  test('multi-segment failure carries the accessed segments in details', () => {
    const nested = ((u: Record<string, Record<string, unknown>>) =>
      u['profile']['city']) as unknown as (u: User) => unknown;
    try {
      extractKey<User>(nested);
      throw new Error('expected extractKey to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SelectorExtractionError);
      expect((err as SelectorExtractionError).details).toEqual({ accessed: ['profile', 'city'] });
    }
  });
});
