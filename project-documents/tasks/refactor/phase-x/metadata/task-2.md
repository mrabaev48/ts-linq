---
status: completed
phase: phase-x
package: metadata
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: []
---

# Refactor: Split the `MetadataRegistry` god class (~575 LOC) — duplicated "finalized-vs-builder" branching across ~25 mutators

## Problem
`MetadataRegistry` (`packages/metadata/src/MetadataRegistry.ts`, ~575 LOC, class at line 35)
is a god class that owns the entire metadata mutation surface: columns, primary keys,
relationships, indexes, validations, alternate keys, schema, temporal, owned entities,
complex properties, hierarchy, skip-navigations, query filters, seed data, check
constraints, comments, table fragments, shadow properties, keyless/view config, and stored
procedure mappings. Almost every mutator repeats the identical control-flow:

```
const key = this.normalizeTarget(target);
const finalized = this.entities.get(key);
if (finalized) { /* mutate finalized */ return; }
this.getOrCreateBuilder(target). /* delegate */
```

This "is it finalized or still a builder?" branch is duplicated in ~25 methods, each
hand-rolling the merge/dedup logic.

## Evidence
- `MetadataRegistry.ts:35` class declaration; methods span lines 42-574.
- The finalized-vs-builder branch repeats in: `registerEntity` (98), `addColumnMetadata` (109), `addPrimaryKeyMetadata` (144), `addRelationshipMetadata` (156), `addIndexMetadata` (166), `addValidationRuleMetadata` (206), `mergeFluentColumn` (279), `setFluentPrimaryKeys` (295), `mergeFluentRelationship` (306), `mergeFluentIndex` (324), `mergeFluentAlternateKey` (340), `mergeFluentSchema` (357), `mergeFluentTemporal` (368), `addComplexProperty` (386), `addOwnedEntity` (396), `setHierarchyMetadata` (412), `setHierarchyRoot` (423), `mergeFluentSkipNavigation` (434), `mergeFluentQueryFilter` (450), `setSeedData` (467), `setCheckConstraints` (478), `setEntityComment` (489), `mergeFluentTableFragments` (500), `addShadowProperty` (511), `setFluentKeyless` (525), `setFluentViewName` (536), `setFluentViewSql` (547).
- Index validation logic (duplicate-name + unknown-column checks) is **duplicated** for the finalized path (lines 169-184) and the builder path (lines 187-203) in `addIndexMetadata`.

## Why this is bad
- **Maintainability**: any change to the finalize/merge contract must be applied ~25 times.
- **Bug risk**: the index validation already diverges between two near-identical copies; drift is likely elsewhere.
- **Extensibility**: every new metadata facet adds yet another copy of the branch.
- **Testability**: the class is a single unit; you cannot test "column merge" without the whole registry.

## Target architecture
Apply SRP + composition. Two complementary moves:
1. Unify the "mutate finalized OR delegate to builder" pattern into a single private helper
   `mutate(target, applyToFinalized, applyToBuilder)` (Template Method), eliminating the
   repeated branch.
2. Group facets into cohesive collaborators (e.g. `ColumnMetadataStore`, `RelationshipStore`,
   `IndexStore` with its validation, `ConstraintStore`, `AdvancedMappingStore`) that the
   registry composes. The registry becomes a thin facade delegating to facet stores.

## Proposed refactor
1. Introduce `private mutate<R>(target, onFinalized: (m: EntityMetadata) => void, onBuilder: (b: EntityMetadataBuilder) => void): void` and route all mutators through it.
2. Extract index dedup/unknown-column validation into one `validateIndex(columns, indexes, name)` used by both paths.
3. Group facet methods into collaborator classes injected into the registry (composition).
4. Keep the public method names/signatures identical (the registry facade) for backward compatibility.
5. Add focused unit tests per facet store.

## Suggested design patterns
- **Template Method** — `mutate()` captures the invariant finalize/builder skeleton.
- **Extract Class / Composition** — facet stores own cohesive subsets.
- **Facade** — `MetadataRegistry` delegates to facets without changing its public API.
- **Builder** — `EntityMetadataBuilder` already exists; keep it as the pre-finalize accumulator.

## Testing plan
- Unit: `mutate()` applies to finalized vs builder correctly.
- Unit: index validation single source rejects duplicate names + unknown columns in both states.
- Regression: full existing metadata test suite passes (decorator + fluent registration).

## Acceptance criteria
- [ ] The finalized-vs-builder branch exists in exactly one helper.
- [ ] Index validation logic exists once.
- [ ] `MetadataRegistry` public API unchanged.
- [ ] File size materially reduced; facets unit-tested.
- [ ] Cluster validations pass.

## Refactor order
After `metadata/task-1` (port extraction) so facet stores can implement the read/write ports cleanly.

## Notes
`EntityMetadataBuilder` (`EntityMetadata.ts`, ~342 LOC) has the parallel facet sprawl and a 30+-line conditional spread in `build()` (lines 290-339); consider aligning its facet grouping with the registry's for symmetry — capture as a sub-task if it grows.
