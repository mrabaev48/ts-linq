# orm task-7 — Split EntityTypeBuilder config axes (✅ COMPLETED)

**Branch:** `audit-refactor/orm-split-entity-type-builder` (stacked on `audit-refactor/orm-boundary-followups`, i.e. on top of unmerged task-6.1, per user decision — NOT branched from main).
**Type:** P2 / medium-risk / clean-code — purely structural, no public API or runtime behaviour change.
**Version:** `@ts-linq/orm` 6.0.1 → 6.0.2 (patch).

## What changed
`packages/orm/src/builders/EntityTypeBuilder.ts` was a 573-LOC god-builder: ~22 private accumulators
+ a 119-line `_applyToRegistry`. Decomposed into a **Facade over a Composite of per-concern
aspects** (SRP + OCP). Facade now **304 LOC** with ZERO business logic — each fluent method is a
thin delegator.

## New structure: `packages/orm/src/builders/aspects/`
- `EntityConfigAspect.ts` — interface `EntityConfigAspect<T>.applyTo(registry, ctor, ctx)` +
  `AspectApplyContext` value object (mutable, carries cross-aspect data).
- 11 aspect classes (each owns its accumulators + fluent method bodies + `applyTo`):
  `KeyAndTableAspect` (table/schema/keys — publishes `ctx.primaryKeys`),
  `ColumnAspect` (columns + shadow props + entity access mode; exposes `columns`/`shadowColumns`
  maps for the facade's `property()`),
  `RelationshipAspect` (hasOne/relationships; ctor-constructed),
  `IndexAndConstraintAspect` (indexes + alt keys + check constraints; ctor-constructed),
  `InheritanceAspect` (TPH/TPT/TPC + discriminator),
  `OwnedAndComplexAspect` (owns one/many + complex; holds `resolveOwnedArgs`; ctor-constructed),
  `SkipNavigationAspect` (m2m; reads `ctx.primaryKeys?.[0] ?? 'id'`),
  `TableSplittingAspect` (entity splitting),
  `QueryFilterAspect` (owns `_queryFilters` + `hasQueryFilterCompiled` + `getQueryFilters`;
  `applyTo` is a **no-op** — filters are per-context, not written to the global registry),
  `StoredProcedureAspect` (insert/update/delete SP mapping),
  `MiscMetadataAspect` (temporal/seed/comment/keyless/view — single-field concerns grouped).

## Explicit apply order (was implicit)
`EntityTypeBuilder._applyToRegistry` = ordered loop over private `_applyOrder` array with a
documented contract. Hard constraints: (1) `KeyAndTableAspect` first (`addEntity` creates the
registry record; publishes `ctx.primaryKeys`); (2) `SkipNavigationAspect` after it (reads
`ctx.primaryKeys` for m2m left FK — the former implicit "skip-nav after PKs" at old line 512).
`RelationshipAspect` still runs before `SkipNavigationAspect` (preserves the stub-relationship
splice-then-merge m2m behaviour). All other aspects write independent, ctor-keyed registry entries.

## Invariants preserved
- Fluent public API: every method signature unchanged (load-bearing — `src/index.ts`).
- `declare readonly __tsLinqEntityTypeBuilderBrand: true` unchanged — transformer's
  `EntityTypeBuilderGuard.receiverIsEntityTypeBuilder` is a structural `hasTypeBrand` check on this
  property; `hasQueryFilter`/`hasQueryFilterCompiled` remain on the facade.
- `_applyToRegistry` / `_getQueryFilters` (@internal) signatures unchanged (ModelBuilder consumer).
- Aspects are **internal** — not re-exported from the barrel (OrmPublicBarrel.test.ts gate passed).

## Tests
- New `tests/entity-config-aspects.test.ts` (13 tests): per-aspect `applyTo` vs real
  `createMetadataRegistry()`, plus the ordering contract (KeyAndTable publishes → SkipNav consumes;
  fallback to 'id'; and a `jest.spyOn` invocationCallOrder guard that KeyAndTable runs before
  SkipNav inside `_applyToRegistry`).
- All 6 listed builder regression suites pass unchanged (96 tests). Full unit suite: 378 suites /
  3769 tests green.

## Validation outcomes
- `pnpm typecheck` ✅, `pnpm lint` ✅ (0 errors; 264 warnings — all pre-existing `any` `no-unsafe-*`
  family; net -2 vs baseline 266), `pnpm build` ✅, `pnpm arch:cycles` ✅ (no cycles),
  `pnpm arch:dead` ✅ (no new dead exports), full `pnpm test:unit` ✅.
- `pnpm arch:deps` — **could not run in this env**: dependency-cruiser 17.4 imports `styleText` from
  `node:util` which requires Node ≥ 20.12; host is Node v20.10.0 (pre-existing tooling/runtime
  mismatch, unrelated to this change).
- `pnpm test:integration` / e2e — **blocked by environment**: the `mssql` Docker container fails
  with `PAL initialization failed. Error: 101` (SQL Server image cannot init on this host);
  postgres/mysql/redis/memcached are healthy. Would fail identically on main. Structural change is
  fully covered at the unit level.

## Tech debt / follow-ups
- `@typescript-eslint/no-explicit-any` suppressions moved verbatim into aspects
  (`OwnedAndComplexAspect._ownedBuilders`/`_complexBuilders`, `InheritanceAspect._discriminatorBuilder`,
  `SkipNavigationAspect.skipNavBuilders`) — heterogeneous builder collections whose second type
  param varies per fluent call. Possibly typeable as `<T, object>` / `<unknown>` since the called
  methods (`_buildMetadata`/`_build`/`_applyToRegistry`) don't expose that param; deferred to avoid
  variance risk in a behaviour-preserving refactor.
- No implicit ordering remains: every apply-order dependency is now explicit in `_applyOrder` +
  `AspectApplyContext`.

**Next orm task = task-8** (reduce `as unknown as` casts in DbSet factory). orm package stays
🔄 In Progress.
