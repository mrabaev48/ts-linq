---
status: completed
phase: phase-x
package: metadata
priority: P2
effort: M
risk: medium
category: typescript
depends_on: []
related: ['metadata/task-1.md']
---

# Refactor: Eliminate `Function`-typed entity keys and unsafe casts in the metadata model

## Problem
The metadata layer keys every store on the structural `Function` type and threads it through
the entire API, and relies on `as unknown as` casts in helpers. `Function` is an unsafe,
overly-broad type (it accepts any callable, not just entity constructors), defeats
constructor-shape checking, and is flagged by `@typescript-eslint/ban-types`. The casts hide
real type mismatches.

## Evidence
- `packages/metadata/src/MetadataRegistry.ts` — `Map<Function, EntityMetadata>` (line 36), `Map<Function, EntityMetadataBuilder>` (line 37), `Map<Function, EntityStoredProcedureMapping>` (line 38); every public/private method takes `target: Function` (e.g. lines 42, 98, 109, 218, 252…).
- `MetadataRegistry.ts:230` — `original !== target ? { ...meta, target } : meta` re-bases `target` but the type stays `Function`.
- `as unknown as` casts: `packages/metadata/src/ValidIf.ts:34,49`, `packages/metadata/src/reflectUtils.ts:7`, `packages/metadata/src/builtins/EnumToStringConverter.ts:21`, `EnumToNumberConverter.ts:17`.
- `EntityMetadataBuilder` mutates internal arrays via `this.metadata.columns!.push(...)` patterns and a `Partial<EntityMetadata> & {…}` intersection (`EntityMetadata.ts:24-40`) that re-declares many already-optional fields.

## Why this is bad
- **Type safety**: `Function` accepts non-constructors; a wrong argument compiles and fails at runtime.
- **API clarity**: callers cannot tell the parameter must be an entity *constructor*.
- **Lint**: `ban-types` discourages `Function`; the casts mask the underlying mismatch.

## Target architecture
Introduce a constructor type alias `type EntityCtor = abstract new (...args: any[]) => object`
(or `Function & { prototype: object }`) and use it consistently as the map key and parameter
type. Replace `as unknown as` casts with precise generic signatures. Tighten
`EntityMetadataBuilder`'s internal state to a single coherent partial type instead of the
intersection re-declaration.

## Proposed refactor
1. Define `EntityCtor` in `@ts-linq/types` and use it as the key/param type across `MetadataRegistry`, `MetadataStorage`, `EntityMetadataBuilder`.
2. Replace `as unknown as` in `ValidIf`/converters with correctly-parameterized generics.
3. Consolidate `EntityMetadataBuilder.metadata` to one typed shape (drop the redundant intersection of already-optional fields in `EntityMetadata`).
4. Verify reflect-metadata access stays typed (one cast confined to `reflectUtils`).
5. Enable `ban-types`/`no-unnecessary-type-assertion` for the package.

## Suggested design patterns
- **Branded/constructor type** to make illegal arguments unrepresentable.
- **Anti-corruption boundary** — confine any remaining reflect cast to one helper.

## Testing plan
- Type-level: passing a non-constructor to `addEntity` is a compile error.
- Unit: behaviour unchanged for valid constructors.
- Regression: full metadata suite passes.

## Acceptance criteria
- [ ] `Function` replaced by `EntityCtor` across the metadata public API.
- [ ] `as unknown as` removed except one audited reflect helper.
- [ ] `EntityMetadataBuilder` internal type consolidated.
- [ ] `ban-types` lint enabled; validations pass.

## Refactor order
After `metadata/task-1`/`task-2` so the new key type lands once on the consolidated API. Coordinate with `core/task-7` (core also removes casts) to keep the constructor type consistent across packages.

## Notes
`EntityCtor` is a breaking *type* change to the public metadata API (parameter types narrow);
per the changeset rules this likely warrants a `minor` (or `major` if it rejects currently-valid
calls). Document migration in the changeset.
