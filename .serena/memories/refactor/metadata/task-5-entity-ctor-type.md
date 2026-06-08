# refactor metadata/task-5: EntityCtor / EntityCtorRef (Function elimination)

**Status: completed.** Metadata refactor cluster (task-1..5) now fully done.

## Core decision: read/write constructor-type split (`@ts-linq/types/metadata.ts`)
- `EntityCtor = abstract new (...args: unknown[]) => object` (from types/task-4) — **write/registration**
  type. Only parameterless classes assign (matches ORM `new ()` runtime). Rejects plain functions.
- **NEW** `EntityCtorRef = abstract new (...args: unknown[]) => unknown` — **read/lookup** type.
  Broader: accepts projection element ctors (`new () => string` from `Queryable.select`), still
  rejects plain functions. `EntityCtor` ⊆ `EntityCtorRef`.

### Why the split (critical finding)
`getEntity` cannot be `EntityCtor` (`=> object`): `Queryable<T>` legitimately holds scalar `T`
(projections via `select`), so read callers pass `new () => <scalar>`. Forcing `EntityCtor` /
`<T extends object>` through query breaks `select()` and cascades into the public `Queryable<T>`
generic. `EntityCtorRef` contains the blast radius at the metadata read boundary. (User-endorsed.)

## Narrowed off `Function`
- **types**: `MetadataSource` reads → `EntityCtorRef`; `MetadataSink` writes → `EntityCtor`;
  `TrackedEntity.entityClass`, `EntityChangeContext.entityClass`, `FallbackRequest.entityClass/entity`,
  `EntityCacheLike` get/set/remove, `EntityAttacher.attach` → `EntityCtorRef`.
  `ValueGeneratorContext.entityClass` (value-conversion.ts) stays `Function` — narrowing = DAG cycle
  (metadata imports value-conversion); doesn't reach a narrowed read.
- **metadata/src**: ALL `Function` removed (maps keyed `EntityCtor`; reads `EntityCtorRef`).
  `EntityMetadataBuilder.metadata` collapsed to single `Partial<EntityMetadata>`.
- **core**: `DatabaseProvider` CUD params → `EntityCtorRef`; class decorators `@Entity`/`@Index`
  constrained `<T extends EntityCtor>` (no cast; non-ctor target = compile error at use site);
  property decos use clean `target as EntityCtor` / `{ constructor: EntityCtor }`.
- **orm**: change-tracker/DbContext/commands/services entityClass → `EntityCtorRef`
  (`DbFunctionBuilder._fn`, `ModelBuilder.hasDbFunction(fn)` stay `Function` — DB-function lambdas).
- **providers**: CUD overrides → `EntityCtorRef`. **query**: `GlobalFilterApplier.apply`,
  `Queryable.thenInclude` local → `EntityCtorRef` (internal). **plugins**: single boundary cast
  `context.entityClass as EntityCtor`.

## Casts: only remaining `as unknown as` in metadata/src = audited `reflectUtils` probe.
Added single necessary casts: getEntity/getStoredProcedureMapping `as EntityCtor`, resolveOriginal
`maybe as EntityCtor`, builtins `v as T`. Lint-clean.

## Lint: root `eslint.config.mjs` scoped block for `packages/metadata/src/**`:
`no-unsafe-function-type: error` (ban-types successor) + `no-unnecessary-type-assertion: error`.

## Type-level test: `packages/metadata/test-d/entity-ctor.test-d.ts` (tsd). Added `tsd` devDep +
`test-d` script to metadata package.json; wired into repo `turbo run test-d`.

## Changeset (`.changeset/metadata-entity-ctor-type.md`)
types/metadata/core/orm/provider-* = **major** (public param/field narrowing rejects `Function`
args); query/plugin-* = **patch** (internal). testkits excluded per its CLAUDE.md. NOTE: original
plan assumed types unchanged — wrong; types got major.

## Validation: typecheck ✓ 32/32, lint ✓ 0 err, build ✓ 32/32, test-d ✓ 34/34, unit ✓ 3024,
arch deps/cycles/dead ✓. Integration/e2e NOT run (real DBs, hang in bg; type-only change).

## Follow-ups
- `core/task-7`: reuse `EntityCtor`/`EntityCtorRef` from types, finish core cast cleanup.
- `resolveEntityRef.ts` `EntityRefResolutionError extends Error` still violates §16 (→ OrmError) —
  out of scope, tech debt.
- `ValueGeneratorContext.entityClass` still `Function` (DAG-cycle) — relocate EntityCtorRef to a
  no-dep module if ever needed.
