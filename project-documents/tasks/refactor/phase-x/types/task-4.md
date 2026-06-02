---
status: completed
phase: phase-x
package: types
priority: P3
effort: S
risk: low
category: typescript
depends_on: ['types/task-1.md']
related: ['metadata/task-5.md']
---

# Refactor: Tighten weak types in the shared metadata model (`Function`, broad unions)

## Problem
Several shared metadata interfaces in `@ts-linq/types` use the unsafe `Function` type and
broad unions for entity targets, which propagate weak typing into every consumer (metadata,
core, orm). Tightening them at the source improves type safety project-wide.

## Evidence
- `packages/types/src/index.ts`:
  - `EntityMetadata.target` and `hierarchyRoot` are typed `Function` (see `EntityMetadata` at line 981 and `RelationshipMetadata` at line 757; `targetEntity: Function | (() => Function)` style unions).
  - These `Function`-typed fields are consumed by `MetadataRegistry` (`Map<Function, …>`) and the core loaders, which then cast with `as unknown as` (see `metadata/task-5`, `core/task-7`).
- `RelationshipMetadata.targetEntity` as `Function | (() => Function)` is a recurring source of the loaders' `resolveTargetEntity` branching + casts.

## Why this is bad
- **Type safety**: `Function` accepts any callable; wrong values compile.
- **Cast propagation**: weak source types force `as unknown as` casts downstream (metadata + core).
- **Discoverability**: the union `Function | (() => Function)` does not communicate intent (constructor vs thunk).

## Target architecture
Introduce shared aliases — `type EntityCtor = abstract new (...a: any[]) => object` and
`type EntityRef = EntityCtor | (() => EntityCtor)` — and use them in the metadata
interfaces. Optionally model `EntityRef` as a discriminated union to make "ctor vs thunk"
explicit. Tightening here lets `metadata/task-5` and `core/task-7` drop their casts.

## Proposed refactor
1. Add `EntityCtor`/`EntityRef` to `@ts-linq/types` (ideally in the `metadata.ts` module from `types/task-1`).
2. Replace `Function` in `EntityMetadata.target`, `hierarchyRoot`, and `RelationshipMetadata.targetEntity` with the new aliases.
3. Coordinate downstream adoption (`metadata/task-5`, `core/task-7`).
4. Verify monorepo typecheck; fix any genuinely-wrong call sites surfaced by the tightening.

## Suggested design patterns
- **Branded/constructor type** to make illegal targets unrepresentable.
- **Discriminated union** for ctor-vs-thunk references.

## Testing plan
- Type-level: assigning a non-constructor to `target` is a compile error.
- Monorepo typecheck surfaces and fixes any weak call-sites.
- Regression: no runtime behaviour change.

## Acceptance criteria
- [x] `EntityCtor`/`EntityRef` exist in `@ts-linq/types`.
- [x] `Function` removed from the cited metadata fields.
- [x] Downstream casts (`metadata/task-5`, `core/task-7`) can be removed.
- [x] Monorepo `typecheck`/`build` pass.

## Outcome

**Aliases** (`packages/types/src/metadata.ts`, re-exported via the `index.ts` barrel):
- `export type EntityCtor = abstract new (...args: unknown[]) => object;`
- `export type EntityRef = EntityCtor | (() => EntityCtor);`

Note on the rest-arg type: the audit suggested `(...a: any[])`. We use `unknown[]` instead —
it is the existing repo convention (`ModelBuilder.properties`), is lint-clean under the
`no-explicit-any` rule of `@ts-linq/types` (no `eslint-disable` needed), and is functionally
equivalent for entity constructors, which are uniformly parameterless (`new () => T`). The
construct-signature (`abstract new`) is what makes plain/arrow functions unrepresentable; the
return type (`object`) and the rest-arg type do not affect that guarantee.

**Fields retyped** (all in `metadata.ts`, all `Function`/`() => Function`/`Function[]` → the
aliases): `EntityMetadata.target`, `EntityMetadata.hierarchyRoot`,
`RelationshipMetadata.targetEntity` (→ `string | EntityRef | undefined`),
`RelationshipOptions.targetEntity` (→ `() => EntityCtor`), `DiscriminatorEntry.ctor`,
`HierarchyMetadata.rootEntity`, `HierarchyMetadata.subtypes`, `OwnedEntityMetadata.ownedType`,
`SkipNavigationMetadata.targetEntity`, `SkipNavigationMetadata.joinEntityCtor`.
(`EntityAttacher.attach(entityClass: Function)` is a method param, not an entity-target field —
left as-is.)

**`EntityRef` shape — simple union, not discriminated.** Modelling it as a discriminated union
was rejected: it would require a runtime tag/wrapper (forbidden in this type-only package) and
break the natural `() => Target` decorator ergonomics. `typeof` `prototype` checks already
distinguish ctor-vs-thunk at runtime (`resolveTargetEntity`). Recorded as tech debt; not planned.

**Cross-package impact (empirically sized via `pnpm typecheck`):**
- *Clean tightenings (no casts):* decorator params `() => Function`→`() => EntityCtor`
  (`metadata`+`core` `Relationships.ts`); `loadCompiledModel` / `resolveClass` classMap →
  `Record<string, EntityCtor>` (`compiled-model-hydrator.ts`); orm builder entity generics
  constrained `<T extends object>` (`EntityTypeBuilder`, `ModelBuilder.entity`,
  `IEntityTypeConfiguration`, navigation/owned/collection/discriminator builders);
  `CompiledModelClassMap` (`orm`) and `DbContextOptions.compiledModelClassMap` (`core`) →
  `Record<string, EntityCtor>`; **removed** the obsolete `as unknown as Function` in
  `OwnedNavigationBuilder._buildMetadata`.
- *Bridge casts deferred to `metadata/task-5`:* the `MetadataRegistry`/`EntityMetadataBuilder`
  keep `Function`-typed keys, so 4 `as EntityCtor` narrowings remain at the
  Function-key→EntityCtor-field boundary (`EntityMetadata.ts` ×2, `MetadataRegistry.ts` ×2),
  each annotated `task-5`.
- *Still deferred (valid widening casts, not required for green):* `core` `EntityLoader`/
  `RelationshipLoader` `resolveTargetEntity` casts (`core/task-7`), `cli`
  `CompiledModelEmitter` `as Function & { name?: string }` reads (`EntityCtor` intentionally
  has no `.name`), `Map<Function, …>` registry/identity-map keys.

**Changeset:** `major`. Narrowing the type of exported `EntityMetadata`/`RelationshipMetadata`
fields is a breaking change per `packages/types/CLAUDE.md` (external consumers passing a
non-constructor no longer compile). `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/orm` also
narrowed public signatures (decorators, builder generics, class-map options) and are bumped
`major` in lockstep, though the changes are source-compatible for all conforming consumers.

**Validation:** `typecheck` 32/32, `lint` 0 errors, `test:unit` 2964, `test:integration` 464,
`test:e2e` 290, `build` 32/32, `arch:deps`/`arch:cycles`/`arch:dead` clean. No runtime change
(the aliases erase at compile time). A few test fixtures that typed nav properties as `unknown`
were corrected to `object` to satisfy the tightened builder generics.

## Refactor order
After `types/task-1`; sequence before/with `metadata/task-5` and `core/task-7` so the casts are
removed against the tightened source types.

## Notes
Narrowing a public field type can be a breaking change if consumers pass non-constructors;
classify the changeset as `minor`/`major` after the monorepo typecheck shows the real impact.
This is P3 because it is an enabler, not an independent defect — prioritize only with the
downstream cast-removal tasks.
