# refactor/query/task-3 — QueryContext value object (✅ DONE, PR #199)

query's **4th** completed refactor task (after task-4, task-8, task-6). Branch
`audit-refactor/query-context-value-object`.

## What changed
- New **`packages/query/src/QueryContext.ts`** — immutable `@internal` value object bundling the
  10 cross-cutting, chain-invariant fields (`provider, entityLoader, entityCache, performance,
  globalFilters, softDeleteOptions, entityAttacher, trackingMode, globalSplittingBehavior,
  entityQueryFilters`) **plus `visitorFactory`** (shared `DEFAULT_VISITOR_FACTORY` singleton —
  `SqlVisitorFactory` from task-4 is now folded onto the context; the per-instance
  `_visitorFactory` field on `Queryable` is gone). Has `with(overrides)` **wither** (spread-based;
  explicit `undefined` clears a field) and `static fromProvider(provider, overrides?)`.
  Exported via `src/internal/index.ts` → `@ts-linq/query/internal`.
- **`Queryable` constructor is now `(entityClass, context: QueryContext, model?)`** (was 11
  positional args). Instance fields (`_provider`, `_trackingMode`, …) are kept and **seeded from
  the context** (so the ~1800-line body of `this._x` reads is untouched). New
  `private readonly _context` field; `import type { QueryContext }` (type-only — class only used as
  a type inside Queryable; never `new`ed there).
- `clone()` → `new Queryable(this._entityClass, this._context)` + same post-construction copies.
- `ofType()` → `this._context.with({ entityAttacher, trackingMode, entityQueryFilters: undefined })`
  — preserves the **intentional** drop of `entityQueryFilters` for subtype queries, now explicit.
- `createSqlVisitor()` → `this._context.visitorFactory.create(...)`.
- `OrderedQueryable` untouched (built via `Object.create`, not the constructor).

## Latent bug fixed (call out in changeset)
`selectCompiled` (projection behind `select(...)`) built with only the first 5 args, silently
dropping globalFilters/softDelete/attacher/trackingMode/splitting/entityQueryFilters. Now carries
the **full context** + per-chain state (`_trackingMode, _entityAttacher, _splittingBehavior,
_ignoredFilters`) like `clone()`. Regression test added.

## Composition roots (orm)
`DbSet.newQueryable()` and `DatabaseFacade` (2 sites) build `new QueryContext({...})` once. Both
import `{ QueryContext }` from `@ts-linq/query/internal` (allowed: dep-cruiser rule
`no-query-internal-from-non-collaborators` whitelists orm + integration-tests; forbidding rules
only match `*/src`, so test files anywhere may import it).

## Decision: HARD CUTOVER (no legacy overload)
User chose to remove the positional constructor entirely. All ~30 `new Queryable(E, provider)`
test sites across `query/tests*`, `core/tests-old`, `integration-tests` rewritten to
`QueryContext.fromProvider(provider[, {overrides}])`. (`core/tests-old` is ignored by
`jest.unit.config.js` but updated for consistency.) `transformer` test has `new Queryable<User>()`
inside string literals — left alone.

## Gotchas
- typescript-eslint in **orm** treats deep `@ts-linq/query/internal` types as "error typed / could
  not be resolved" → benign `no-unsafe-argument`/`no-unsafe-call` **warnings** (0 errors). This is
  PRE-EXISTING (DbContext's `EnhancedSqlCache`/`InMemoryCountCache` already warn the same way). Real
  `tsc` typecheck is clean.
- `jest` resolves `@ts-linq/query/internal` → `packages/query/src/internal` (no dist build needed
  for unit tests), but `tsc`/lint resolve the built `dist/internal/index.d.ts` — **rebuild query
  before orm typecheck/lint**.

## Versions / validation
`@ts-linq/query` 2.4.37→**2.4.38** patch, `@ts-linq/orm` 4.0.20→**4.0.21** patch. All green:
typecheck 32/32, lint 0 errors, unit 3211, integration 461 (2 skipped), e2e 290, build 32/32,
arch deps/cycles/dead clean.

## Unblocks
`query/task-2` (immutability — next) and `query/task-1` (god-class decomposition) — both build on
the shared `QueryContext` construction unit. Remaining query tasks: 2, 1, 7, 5, 9, 10.
