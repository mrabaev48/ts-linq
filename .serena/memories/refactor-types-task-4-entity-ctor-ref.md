# refactor types/task-4 — EntityCtor / EntityRef (entity-target tightening)

**Status:** completed. Branch `refactor-types-tighten-metadata-types` (off fresh `origin/main`).

## What changed
Two type-only aliases added to `packages/types/src/metadata.ts` (re-exported via the `index.ts`
barrel; runtime `Object.keys` manifest unchanged):
- `export type EntityCtor = abstract new (...args: unknown[]) => object;`
- `export type EntityRef = EntityCtor | (() => EntityCtor);`

Rest-arg is `unknown[]`, NOT `any[]` (the audit said `any[]`). Reason: repo convention
(`ModelBuilder.properties`), lint-clean under `@ts-linq/types` `no-explicit-any` (no
`eslint-disable`), equivalent for entity ctors (all parameterless `new () => T`). The
`abstract new` construct-signature is what rejects plain/arrow functions — return type and
rest-arg do not affect that.

`Function` replaced in (all in `metadata.ts`): `EntityMetadata.target`, `EntityMetadata.hierarchyRoot`,
`RelationshipMetadata.targetEntity` (→ `string | EntityRef | undefined`),
`RelationshipOptions.targetEntity` (→ `() => EntityCtor`), `DiscriminatorEntry.ctor`,
`HierarchyMetadata.rootEntity`, `HierarchyMetadata.subtypes`, `OwnedEntityMetadata.ownedType`,
`SkipNavigationMetadata.targetEntity`, `SkipNavigationMetadata.joinEntityCtor`.
`EntityAttacher.attach(entityClass: Function)` left as-is (method param, not a target field).

**EntityRef is a simple union, deliberately NOT a discriminated union** (a DU needs a runtime
tag/wrapper — forbidden in this type-only package — and breaks `() => Target` decorator
ergonomics; `typeof prototype` already distinguishes ctor vs thunk). Recorded as tech debt.

## Cross-package impact (whole monorepo went green)
Reads stay green because `EntityCtor`/`EntityRef` are assignable to `Function` and
`Function | (() => Function)`. Breakage was at WRITE sites + unconstrained generics.

Clean tightenings (no casts / removed casts):
- `@ts-linq/metadata` + `@ts-linq/core` relationship decorators: param `() => Function` → `() => EntityCtor`.
- `@ts-linq/metadata` `compiled-model-hydrator.ts`: `resolveClass`/`hydrateEntity`/`loadCompiledModel` classMap → `Record<string, EntityCtor>`.
- `@ts-linq/orm` `OwnedNavigationBuilder._buildMetadata`: REMOVED `ownedType: ... as unknown as Function`.
- `@ts-linq/orm` `DiscriminatorBuilder._entries.ctor` → `EntityCtor`.
- `@ts-linq/orm` fluent builders constrained `<T extends object>`: `EntityTypeBuilder<T>`,
  `ModelBuilder.entity`/`applyConfiguration`, `IEntityTypeConfiguration<T>`,
  `hasOne`/`hasMany`/`ownsOne`/`ownsMany`/`hasValue`, `CollectionNavigationBuilder`,
  `ReferenceNavigationBuilder`, `CollectionCollectionBuilder` (+ `usingEntity`), `resolveOwnedArgs`,
  `OwnedNavigationBuilder<TOwner, TOwned extends object>`. `EntityTypeBuilder<unknown>` →
  `<object>` in `_builders` map and the two `as ... <object>` casts. `createSyntheticClass`
  return → `new () => object`.
- `@ts-linq/orm` `CompiledModelClassMap` + `@ts-linq/core` `DbContextOptions.compiledModelClassMap` → `Record<string, EntityCtor>`.
- Test fixtures with `profile?: unknown` nav props → `object`; removed `as unknown as Function` in test metadata.

Bridge casts deferred to **metadata/task-5** (registry keeps `Function`-typed keys): 4 ×
`as EntityCtor` at the Function-key→EntityCtor-field boundary — `EntityMetadata.ts` (ctor
`target`, `setHierarchyRoot`), `MetadataRegistry.ts` (`getEntity` spread, `setHierarchyRoot`),
each annotated `task-5`.

Still deferred (valid widening casts, NOT required for green) → **core/task-7** / cleanup:
`core` `EntityLoader`/`RelationshipLoader` `resolveTargetEntity` casts; `cli`
`CompiledModelEmitter` `as Function & { name?: string }` (EntityCtor intentionally has no
`.name`); `Map<Function, …>` keys in `MetadataRegistry`/`ModelBuilder`/`DbContext`/`IdentityMap`.

## EntityCtor has NO `.name`
`abstract new (...) => object` is a bare construct signature — accessing `.name` on an
`EntityCtor`-typed value is a TS error. Code needing the class name keeps the existing
`(x as Function & { name?: string }).name` pattern (or reads via a `Function`-typed key).

## Changeset
`major` for `@ts-linq/types`, `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/orm`
(file `.changeset/tighten-metadata-entity-ctor.md`). Field-type narrowing on exported
interfaces is breaking per `packages/types/CLAUDE.md`; downstream signature narrowings are
source-compatible for conforming consumers but bumped major in lockstep. Internal dependents
cascade automatically.

## Validation (all green)
typecheck 32/32, lint 0 errors, test:unit 2964, test:integration 464, test:e2e 290, build
32/32, arch:deps/cycles/dead clean. No runtime change (aliases erase at compile time).
Negative type-level tests (plain fn / arrow fn rejected, class accepted) in
`packages/types/src/__tests__/exports.check.ts` via `@ts-expect-error`.

## Gotcha for future tasks
`pnpm typecheck` resolves cross-package types from built `dist/*.d.ts`. After editing a
package's public types, REBUILD before trusting `pnpm typecheck` on dependents — stale dist
masked the `compiledModelClassMap` breakage until `pnpm build` ran (ts-jest compiles from
source and caught it earlier).
