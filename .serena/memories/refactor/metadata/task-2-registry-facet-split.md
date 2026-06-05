# refactor metadata/task-2: MetadataRegistry facet split + mutate() Template Method

**Status:** completed (branch `audit-refactor/metadata-registry-facet-split`, base main `5eb1cb9f`).
Behaviour-preserving god-class split of `packages/metadata/src/MetadataRegistry.ts` (~580 → ~290 LOC).

## What changed
The repeated finalized-vs-builder branch (`normalizeTarget → entities.get → if finalized … else
getOrCreateBuilder`), hand-rolled across ~27 mutators, is now a **single Template Method**, and the
mutators are grouped into cohesive facet stores composed behind an **unchanged** `MetadataRegistry`
facade (still `implements MetadataSource, MetadataSink` from task-1). Public API byte-for-byte identical.

## New internal layer — `packages/metadata/src/registry/` (NOT exported from the barrel)
- `EntityMetadataState.ts` — shared kernel. Owns `entities` + `builders` Maps. Single
  `mutate(target, onFinalized:(m)=>void, onBuilder:(b)=>void)` seam, plus `normalizeTarget`,
  `getOrCreateBuilder`, `finalizeEntity`, `finalizeAllBuilders`, `hasBuilder`, `getFinalized`,
  `getAllEntities`, `clearState`. Holds **no** facet refs → graph stays acyclic.
- `validateIndex.ts` — pure `validateIndex(index, existingIndexes, existingColumns, tableName)`;
  the single source for dup-name + unknown-column rules (error wording preserved verbatim). Used by
  IndexStore for **both** finalized and builder states (previously duplicated + drifted).
- Seven facet stores, each `constructor(state: EntityMetadataState)`, routing via `state.mutate`:
  - `ColumnMetadataStore` — addColumn (+computed/default validation), mergeFluentColumn, addPrimaryKey, setFluentPrimaryKeys, addShadowProperty
  - `RelationshipStore` — addRelationship, mergeFluentRelationship
  - `IndexStore` — addIndex (validateIndex), mergeFluentIndex, mergeFluentAlternateKey
  - `ConstraintStore` — addValidationRule, setCheckConstraints
  - `TableConfigStore` — registerEntity, mergeFluentSchema, mergeFluentTemporal, mergeFluentTableFragments, setFluentKeyless, setFluentViewName, setFluentViewSql, setEntityComment, setSeedData
  - `AdvancedMappingStore` — addOwnedEntity, addComplexProperty, setHierarchyMetadata, setHierarchyRoot, mergeFluentSkipNavigation, mergeFluentQueryFilter
  - `StoredProcedureStore` — owns its own `spMappings` Map (bypasses builder lifecycle); set/get + clear; uses `state.normalizeTarget`

## Facade specifics (kept on MetadataRegistry, NOT in facets)
- Read methods stay on the facade to avoid read-coupling: `getEntity` (incl. its try/catch
  target-remap — that silent-swallow is task-4, **deliberately untouched**), `getEntities`,
  `getValidationRules`, `getOwnedEntities`. `getStoredProcedureMapping` delegates to SP store.
- `collectPendingMetadata` stays on the facade and calls facets (`columns.addColumn/addPrimaryKey`,
  `indexes.addIndex`, `relationships.addRelationship`) — pending-flush is decorator-driven facet
  registration. `clear()` → `state.clearState()` + `storedProcedures.clear()`.
- Dependency graph: facade → {state, facets}; facets → state; state → EntityMetadataBuilder. Acyclic.

## Tests (new) — `packages/metadata/tests/registry/`
`EntityMetadataState.test.ts` (mutate dispatch + lifecycle), `validateIndex.test.ts` (pure rules),
`ColumnMetadataStore.test.ts`, `IndexStore.test.ts` (describe.each over builder+finalized proves
single-source validation in BOTH states — closed a prior coverage gap), `facet-stores.test.ts`.
+36 unit tests. Facets imported by direct path `../../src/registry/...` (not barrel).

## Validation outcomes (all green)
typecheck ✓; lint 0 errors ✓; unit 3018 (+36) ✓; integration 464 ✓; e2e 290 ✓; build ✓;
arch:deps 846 modules 0 violations ✓; arch:cycles no cycles ✓; arch:dead clean (facets used by
facade, not flagged) ✓. patch changeset `@ts-linq/metadata`.

## Follow-up / tech debt
`EntityMetadataBuilder` (`EntityMetadata.ts` ~342 LOC) still has parallel facet sprawl (24 optional
fields) + 30+-line conditional spread in `build()` (~289–344). Deferred; documented in
`project-documents/tasks/refactor/phase-x/metadata/README.md` (Follow-up section). Plan: mirror the
registry facet grouping onto the builder + replace build() spread with per-facet `applyTo(metadata)`.
