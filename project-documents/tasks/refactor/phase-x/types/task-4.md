---
status: not-started
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
- [ ] `EntityCtor`/`EntityRef` exist in `@ts-linq/types`.
- [ ] `Function` removed from the cited metadata fields.
- [ ] Downstream casts (`metadata/task-5`, `core/task-7`) can be removed.
- [ ] Monorepo `typecheck`/`build` pass.

## Refactor order
After `types/task-1`; sequence before/with `metadata/task-5` and `core/task-7` so the casts are
removed against the tightened source types.

## Notes
Narrowing a public field type can be a breaking change if consumers pass non-constructors;
classify the changeset as `minor`/`major` after the monorepo typecheck shows the real impact.
This is P3 because it is an enabler, not an independent defect — prioritize only with the
downstream cast-removal tasks.
