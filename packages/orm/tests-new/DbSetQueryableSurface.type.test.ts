import { describe, expect, it } from '@jest/globals';
import type { IncludableQueryable, OrderedQueryable, Queryable } from '@ts-linq/query';

import type { DbSet } from '../src/DbSet';

/**
 * Type-level guard for orm/task-3: the `DbSet<T>` query surface (provided by the merged
 * {@link IQueryableSurface}) must preserve `Queryable<T>`'s generic inference *end-to-end* — chaining
 * off a set must be indistinguishable from chaining off a `Queryable`. These assertions are enforced
 * by ts-jest's type-checking; the lone runtime `it` only keeps Jest from reporting an empty suite.
 *
 * What is asserted:
 * - chain-starting operators return `Queryable<T>` and thread the element type;
 * - `select` infers the projected type (no widening to `unknown`);
 * - `orderBy` returns an `OrderedQueryable<T>` so `thenBy` is reachable;
 * - direct terminals (`toArray`/`count`/`take`) remain callable on a `DbSet` (no `.query()` needed);
 * - `include(...).thenInclude(...)` lives on the returned chain, not on `DbSet`.
 */

class TtPost {
  id!: number;
  title!: string;
}
class TtUser {
  id!: number;
  name!: string;
  age!: number;
  posts!: TtPost[];
}

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

declare const users: DbSet<TtUser>;

// Transformer contract: the brand must remain on the type the transformer rewrites `.where`/`.select`
// against (it keys scope detection on `__tsLinqWhereTransformerBrand`), and the compiled operators
// must be part of the surface so the rewritten `.whereCompiled(...)` type-checks.
type _Brand = Expect<Equal<DbSet<TtUser>['__tsLinqWhereTransformerBrand'], true>>;
type _WhereCompiled = Expect<
  Equal<Parameters<DbSet<TtUser>['whereCompiled']>, Parameters<Queryable<TtUser>['whereCompiled']>>
>;

// All assertions below live in a never-called function: only their *types* are checked.
function _dbSetSurfaceTypeTests(): void {
  // Chain start returns Queryable<T>, and inference survives across the chain.
  const filtered: Queryable<TtUser> = users.where((u) => u.age >= 18);
  const projected = users.where((u) => u.age >= 18).select((u) => u.name);
  type _Projected = Expect<Equal<typeof projected, Queryable<string>>>;

  // Object projection threads the projected shape (not `unknown`).
  const shaped = users.select((u) => ({ n: u.name, a: u.age }));
  type _Shaped = Expect<Equal<typeof shaped, Queryable<{ n: string; a: number }>>>;

  // Ordering returns OrderedQueryable so thenBy/thenByDescending are reachable.
  const ordered: OrderedQueryable<TtUser> = users.orderBy('name');
  users.orderBy('name').thenBy((u) => u.age);

  // Direct terminals remain available on a DbSet (backward compatibility preserved).
  const all: Promise<TtUser[]> = users.toArray();
  const total: Promise<number> = users.count();
  const limited: Queryable<TtUser> = users.take(5);

  // Eager-loading: include yields an IncludableQueryable whose thenInclude targets the leaf entity.
  const included: IncludableQueryable<TtUser, TtPost> = users.include((u) => u.posts);
  users.include((u) => u.posts).thenInclude((p) => p.title);

  void filtered;
  void projected;
  void shaped;
  void ordered;
  void all;
  void total;
  void limited;
  void included;
  const _checks: [_Projected, _Shaped] = [true, true];
  void _checks;
}

// Reference the never-called fixture + standalone type checks so unused-var lint stays quiet.
export type __DbSetSurfaceChecks = [typeof _dbSetSurfaceTypeTests, _Brand, _WhereCompiled];

describe('DbSet query surface (type-level)', () => {
  it('preserves Queryable generic inference end-to-end (enforced by ts-jest)', () => {
    expect(true).toBe(true);
  });
});
