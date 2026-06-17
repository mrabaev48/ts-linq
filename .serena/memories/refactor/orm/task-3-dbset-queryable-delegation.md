# refactor/orm/task-3 — Replace DbSet manual Queryable forwarding (✅ DONE)

orm's **3rd** completed refactor task (after task-1 decompose DbContext, task-2 silent catches).
Branch `audit-refactor/orm-dbset-delegation`. P1/L/medium-risk.

## Decision: Hybrid B (user-chosen, NOT strict Option A)

Strict Option A (remove all mid-chain/terminals from DbSet, add `.query()` seed) would be a MAJOR
break: repo alone has 54+ direct-on-DbSet terminal calls (`toArray`×32, `executeUpdate`×14,
`executeDelete`×6, `first*`) — legit EF-parity ergonomics. So chose **Hybrid B = full surface
preserved, zero hand-forwarding, compile-enforced parity**:
- New public type **`IQueryableSurface<T>`** in `@ts-linq/query` (`src/IQueryableSurface.ts`,
  `export type` from barrel) = the full chain-starting operator surface (~55 ops).
- `DbSet<T>` **declaration-merges** it: `export interface DbSet<T extends object> extends
  IQueryableSurface<T> {}` next to the class → full static surface with inference, NO method bodies.
- Runtime: `installQueryableForwarders(DbSet.prototype, self => self._seed())` installs one
  delegating forwarder per operator, each routing to a **cached seed** `Queryable`.

## Key mechanics / gotchas

- **declaration-merge conflicts with explicit methods**: any query method kept explicit on the
  DbSet class that's ALSO in IQueryableSurface = "Duplicate identifier". So DbSet keeps **ZERO**
  explicit query methods — all via merge(types)+loop(runtime). The transformer brand
  (`declare readonly __tsLinqWhereTransformerBrand`) stays as a class field; `where/select/+Compiled`
  are reachable via merge+loop (transformer rewrites on static type+brand, runtime `whereCompiled`
  forwards to seed). Verified `WhereTransformer.test` + e2e.
- **`Queryable` does NOT `implements IQueryableSurface`** — that src import edge forms a CYCLE with
  IQueryableSurface (which imports Queryable for return types) → trips arch:cycles/arch:deps
  (no-circular rule). Contract instead asserted by **type-test** `query/tests-new/
  IQueryableSurface.type.test.ts` (`Queryable<T> extends IQueryableSurface<T> ? true : never`);
  test files are outside the dependency-cruiser graph.
- **join signature widened in interface**: `innerJoinOn/leftJoinOn` precise per-key generics
  (`KL extends keyof T = keyof T`) can't be related across the surface (TS2416 with defaulted type
  params). Interface uses widest assignable shape (`keyof T & string | KeySelector<T, keyof T>`);
  DbSet inherits the widened (still backward-compat) signature. `Queryable` keeps precise generics.
- **seed cache + mutable tracking**: `_seed()` memoizes the seed `Queryable` but
  `ChangeTracker.queryTrackingBehavior` is a PUBLIC MUTABLE field that the old `newQueryable()` read
  every call. So cache is keyed on current tracking and rebuilt when it changes; also cleared at end
  of `_injectContext`. Pooling-safe: `DbContext.reset()` clears tracker/cache IN PLACE (same objects).
- **forwarding denylist** (`QUERYABLE_NON_OPERATORS` in `src/context/queryableForwarding.ts`, single
  source for installer + parity test): constructor, clone, withModel, applyPredicate, buildRunSpec,
  prepareQueryModel, applyGlobalFiltersToModel, resolveColumnName, effectiveSplittingBehavior(getter),
  **thenInclude** (mid-chain only). Plus skip `_`-prefixed + non-functions. New Queryable operator →
  auto-forwarded (zero drift).

## QueryableFactory (single construction site)

`src/context/QueryableFactory.ts` (`@internal`): `fromContext(entityClass, QueryContextProps)` (DbSet
seed) + `raw(entityClass, provider, entityLoader, {sql,params})` (DatabaseFacade sqlQuery/sqlQueryRaw,
which previously duplicated `new Queryable(...,new QueryContext(...))._withRawSqlSource` twice). DbSet
fromSqlRaw/Interpolated use `this._seed()._withRawSqlSource(...)` (full context, unchanged behavior).

## Additive surface (why orm = minor not patch)

DbSet now also exposes `ofType`, `asSplitQuery`, `asSingleQuery`, `toListAsync` (were only on
Queryable) → full parity, backward-compatible. No call-site changes; `ctx.users.toArray()` /
`.executeDelete()` keep working.

## Tests

- `orm/tests-new/DbSetQueryableParity.test.ts` — runtime parity: every `queryableOperatorNames()`
  reachable on a DbSet instance (fails when a new operator isn't surfaced).
- `orm/tests-new/DbSetQueryableSurface.type.test.ts` — type-level: inference end-to-end
  (`where().select()`→Queryable<projected>), direct terminals, orderBy→OrderedQueryable, brand +
  whereCompiled params preserved.
- `query/tests-new/IQueryableSurface.type.test.ts` — Queryable satisfies the contract.

## LOC / versions / validation

DbSet.ts **810 → 383 LOC** (−53%; remainder is preserved DbSet-specific JSDoc, code well under 350).
`@ts-linq/query` 4.0.2→**4.1.0** minor, `@ts-linq/orm` 4.1.14→**4.2.0** minor. ALL green: typecheck
32, lint 33, unit 368 suites/3688, integration 88/461 (2 skip), e2e 19/290, build 32, arch
deps/cycles/dead clean. (unit had one flaky jest-worker SIGSEGV once; clean on rerun.)

## Status

orm stays **🔄 In Progress** (tasks 4–8 pending). Next orm = task-4 (split ChangeTracker).
