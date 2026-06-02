---
status: not-started
phase: phase-x
package: core
priority: P1
effort: M
risk: medium
category: typescript
depends_on: []
related: ['core/task-3.md']
---

# Refactor: Remove `as unknown as` double-casts and `Record<string, unknown>` property punning in the loading layer

## Problem
The loading layer routinely defeats the type system with `as unknown as` double-casts and
`(entity as Record<string, unknown>)[prop]` punning to read/write navigation and FK
properties. This erases the compiler's ability to catch wrong property names, wrong
relationship shapes, and wrong constructor types.

## Evidence
- `packages/core/src/loading/EntityLoader.ts:122-127` and `163-169` — relationships cast `as unknown as { propertyName; foreignKey?; type; targetEntity }`.
- `EntityLoader.ts:285,287,288` — `resolveTargetEntity` casts `as unknown as new () => unknown`.
- Pervasive `(entity as Record<string, unknown>)[key]` assignments, e.g. `EntityLoader.ts:271, 346, 364, 503, 508, 581`; `RelationshipLoader.ts:43, 149, 155, 185, 193, 317`.
- 9 `as unknown as` occurrences in `packages/core/src` (grep), concentrated in loaders.

## Why this is bad
- **Type safety**: a renamed metadata field (`targetEntity` → `target`) compiles fine and fails at runtime.
- **Refactor hostility**: IDEs cannot rename-refactor through the casts.
- **Hidden contracts**: the *real* shape the loader needs is buried in inline cast literals instead of a named type.

## Target architecture
Introduce explicit, narrow view types that the loaders consume — e.g. a
`LoadableRelationship` derived from `RelationshipMetadata` and an `EntityRecord` accessor
abstraction — so property access is mediated by typed helpers rather than `Record` punning.
Apply "make illegal states unrepresentable": model the relationship target as a discriminated
union (`{ kind: 'ctor'; ctor } | { kind: 'thunk'; thunk }`) instead of `Function | (() => Function)`.

## Proposed refactor
1. Define `type LoadableRelationship = Pick<RelationshipMetadata, 'propertyName' | 'foreignKey' | 'type' | 'targetEntity'>` and use it directly (remove the inline `as unknown as {…}`).
2. Add a typed `getProp/setProp<T>(entity, key)` accessor (or a small `EntityRecord` wrapper) to centralize the unavoidable dynamic access in one audited place.
3. Replace `resolveTargetEntity` return casts with a typed resolver returning `new () => object`.
4. Where `targetEntity` is `Function | (() => Function)`, normalize once to a concrete ctor at the boundary and pass the concrete type downstream.
5. Enable/verify `@typescript-eslint/no-unnecessary-type-assertion` and forbid `as unknown as` via lint in the loading dir.

## Suggested design patterns
- **Adapter** — `EntityRecord` adapts an arbitrary entity to typed property access.
- **Discriminated union** for relationship target resolution.
- **Anti-corruption layer** — one place converts metadata shapes into loader view types.

## Testing plan
- Type-level: `tsd`/expect-type tests that `LoadableRelationship` matches metadata fields.
- Unit: typed accessor reads/writes the same values as the prior `Record` punning.
- Regression: loading behaviour unchanged.

## Acceptance criteria
- [ ] No `as unknown as` in `packages/core/src/loading/*`.
- [ ] Dynamic property access centralized in a typed accessor.
- [ ] Lint rule prevents reintroduction.
- [ ] Cluster validations pass.

## Refactor order
Best done together with `core/task-3` (loader split), since both rewrite the same methods; doing them separately would cause churn.

## Notes
Keep one explicitly-audited dynamic-access boundary (ORMs need reflective property access); the goal is to remove *casual* casts, not to ban all dynamic access.
