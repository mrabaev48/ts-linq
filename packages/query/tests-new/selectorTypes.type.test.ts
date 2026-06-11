/**
 * Type-level tests for the honest key-selector types (refactor query/task-5).
 *
 * These assertions are enforced by `tsc --noEmit` (`pnpm typecheck`) — the `// @ts-expect-error`
 * lines fail the build if the offending call ever *stops* being a compile error. A single trivial
 * runtime test keeps Jest from reporting an empty suite.
 *
 * What is asserted:
 * - `KeySelector<T, K>` resolves to the *specific* property value type `T[K]` (not `T[keyof T]`).
 * - `orderBy` / `thenBy` / `innerJoinOn` accept single-property selectors and literal keys.
 * - Nested-path selectors whose leaf type matches no top-level property are rejected at compile
 *   time (the honest single-key contract).
 * - `thenInclude` is typed against the real leaf navigation entity (not `never`): valid nested
 *   navigations complete, unknown ones are rejected, and the chain re-threads at every depth.
 */
import type { KeySelector } from '../src/extractKey';
import type { Queryable } from '../src/Queryable';

// ── Fixtures ────────────────────────────────────────────────────────────────
// `TtAddress.zip` is a `bigint` — a type that no top-level `TtUser` property shares, so a nested
// selector returning it cannot be (mis)inferred onto a sibling key and must be rejected.
class TtTag {
  id!: number;
  label!: string;
}
class TtComment {
  id!: number;
  body!: string;
}
class TtPost {
  id!: number;
  title!: string;
  comments!: TtComment[];
  tags!: TtTag[];
}
class TtAddress {
  zip!: bigint;
}
class TtUser {
  id!: number;
  name!: string;
  age!: number;
  profile!: TtAddress;
  posts!: TtPost[];
}

// ── Type-level helpers ──────────────────────────────────────────────────────
type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// ── KeySelector resolves the specific value type, not the union ─────────────
type _IdSelector = Expect<Equal<KeySelector<TtUser, 'id'>, (entity: TtUser) => number>>;
type _NameSelector = Expect<Equal<KeySelector<TtUser, 'name'>, (entity: TtUser) => string>>;
// Sanity: the value type is the precise property type, never the `T[keyof T]` union.
type _NotUnion = Expect<
  Equal<ReturnType<KeySelector<TtUser, 'id'>> extends string | number ? true : false, true>
>;

// All assertions below live in a never-called function: only their *types* are checked.
function _selectorTypeTests(q: Queryable<TtUser>): void {
  // Ordering: literal key + single-property lambda are accepted.
  q.orderBy('id');
  q.orderBy((u) => u.id);
  q.orderByDescending((u) => u.name);
  q.orderBy('name').thenBy((u) => u.age);
  q.orderBy('name').thenByDescending((u) => u.id);

  // Nested-path selector whose leaf type (bigint) matches no top-level property → compile error.
  // @ts-expect-error nested access is not a single top-level key selector
  q.orderBy((u) => u.profile.zip);
  // @ts-expect-error nested access is rejected on the secondary sort as well
  q.orderBy('name').thenBy((u) => u.profile.zip);

  // Joins: literal keys and single-property lambdas on both sides.
  q.innerJoinOn(TtPost, 'id', 'id');
  q.innerJoinOn(
    TtPost,
    (u) => u.id,
    (p) => p.id
  );
  q.leftJoinOn(TtPost, (u) => u.id, 'id');
}

// ── thenInclude is typed against the actual leaf entity (not `never`) ───────
function _includeChainTypeTests(q: Queryable<TtUser>): void {
  // include(u => u.posts) leaf is TtPost → thenInclude completes against TtPost.
  q.include((u) => u.posts).thenInclude((p) => p.comments);
  q.include((u) => u.posts).thenInclude((p) => p.tags);

  // Multi-level: TtPost → TtComment leaf re-threads for the next thenInclude.
  q.include((u) => u.posts)
    .thenInclude((p) => p.comments)
    .thenInclude((c) => c.body);

  // String-key include still yields a typed leaf for thenInclude.
  q.include('posts').thenInclude((p) => p.title);

  // Unknown nested navigation is rejected — proof the param is NOT `never`.
  // @ts-expect-error 'missing' is not a property of the TtPost leaf entity
  q.include((u) => u.posts).thenInclude((p) => p.missing);
}

// Reference the type-only helpers so unused-var lint stays quiet.
export type __SelectorTypeChecks = [
  _IdSelector,
  _NameSelector,
  _NotUnion,
  typeof _selectorTypeTests,
  typeof _includeChainTypeTests
];

describe('selector types (compile-time contract)', () => {
  it('is validated by tsc --noEmit', () => {
    expect(true).toBe(true);
  });
});
