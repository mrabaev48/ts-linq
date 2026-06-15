---
status: completed
phase: phase-x
package: migrations
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: ["task-6.md"]
---

# Refactor: Decompose snapshot builders into strategy-based expanders

## Problem

`SchemaSnapshot.SchemaSnapshotBuilder` and `snapshot/model-snapshot.ModelSnapshotBuilder`
are two parallel god-builders that each fold every mapping concern — inheritance
(TPH/TPT/TPC), owned entities (TableSplit/Json/SeparateTable), complex types, table
splitting/fragments, and synthesized many-to-many join tables — into one class, read
directly from the global `MetadataStorage` singleton, and duplicate a lot of column-mapping
logic between each other.

## Evidence

- `packages/migrations/src/snapshot/model-snapshot.ts:93-300` — `buildFromMetadata` is a
  ~200-line method handling TPH (129-142), TPT (181-210), TPC (211-273), owned entities
  (`_expandOwnedEntity`, 323-394), complex types (`_expandComplexProperty`, 302-321), and
  join tables (276-294) inline.
- `packages/migrations/src/snapshot/model-snapshot.ts:94` — reads
  `MetadataStorage.getEntities()` directly (global singleton coupling; cannot snapshot an
  arbitrary injected model).
- `packages/migrations/src/SchemaSnapshot.ts:37-192` — `buildExpectedFromMetadata` similarly
  inlines shadow properties (89-100), table splitting (137-165), fragments (167-170,
  194-242), FK resolution (244-298), sequences (175-185).
- `packages/migrations/src/SchemaSnapshot.ts:38` — also reads `MetadataStorage.getEntities()`
  and `SequenceRegistry.getAll()` directly.
- Column-to-snapshot mapping (`name/type/nullable/isPrimaryKey/defaultValue/...`) is
  near-duplicated across `model-snapshot.ts:105-116,193-202,213-223,247-254` and
  `SchemaSnapshot.ts:70-86,204-222`.

## Why this is bad

- **Low cohesion / high complexity:** a single method per builder mixes ~6 orthogonal
  mapping rules; adding a new strategy means editing a 200-line method.
- **Untestable in isolation:** because both read the global registry, you cannot unit-test
  "expand a TPC hierarchy" without populating global decorator state.
- **Duplication:** two builders + repeated column mapping invite divergence (the model
  snapshot and the schema snapshot can drift on, e.g., default handling).
- **Extensibility:** new mapping features (already many: spatial, JSON, complex, owned)
  keep accreting into the same hotspot.

## Target architecture

Apply **SRP**, **Open/Closed**, and **composition-first** with a Strategy/visitor split,
and invert the `MetadataStorage` dependency.

- Define `interface EntityExpander { expand(ctx: ExpansionContext): void }` where the
  context carries the entity, the resolved `entityByType` map, the target table map, and a
  shared `ColumnMapper`.
- Concrete expanders: `InheritanceExpander` (TPH/TPT/TPC), `OwnedEntityExpander`,
  `ComplexTypeExpander`, `TableFragmentExpander`, `SkipNavigationExpander`,
  `ShadowPropertyExpander`, `SequenceExpander`.
- A `ColumnMapper` owns the single column→snapshot mapping (kills the duplication).
- Both builders become thin coordinators that iterate entities and run the registered
  expanders; the entity list is **passed in** (default helper still reads
  `MetadataStorage` for back-compat).

## Proposed refactor

1. Extract `ColumnMapper` with `toModelColumn(...)` / `toSchemaColumn(...)`.
2. Extract each strategy into its own `*Expander` class implementing `EntityExpander`.
3. Refactor `ModelSnapshotBuilder.buildFromMetadata` and
   `SchemaSnapshotBuilder.buildExpectedFromMetadata` to compose an ordered expander list.
4. Add `buildFrom(entities, sequences)` overloads that accept an injected model; keep the
   existing no-arg methods reading the global registry as a default.

Public API: existing builder classes and methods retain signatures; new overloads and
expander classes are additive.

## Suggested design patterns

- **Strategy** (one expander per mapping concern). Why: each strategy is independently
  testable and new strategies are added without touching existing ones (OCP).
- **Visitor-ish coordinator** iterating expanders over entities. Why: keeps ordering
  explicit (sequences before tables, root before subtypes).
- **Dependency Inversion** (inject the entity list). Why: unit-testable without global
  decorator state.
- **Extract Class / Pull Up** (`ColumnMapper`). Why: removes the duplicated column mapping.

## Testing plan

- **Unit (per expander):** feed a hand-built `EntityMetadata` and assert the produced
  tables/columns for TPH/TPT/TPC, owned (each storage strategy), complex, fragment, and
  join-table cases — no global registry needed.
- **Regression:** existing `tests-new/snapshot/*` and `tests/*-snapshot.test.ts` must pass
  unchanged through the back-compat no-arg path.
- **Determinism:** assert canonical sorting is preserved (tables/columns/indexes sorted).

## Acceptance criteria

- [ ] Each mapping concern lives in its own `EntityExpander`.
- [ ] Column→snapshot mapping exists once in `ColumnMapper`.
- [ ] Both builders compose expanders and accept an injected entity list (default reads
      `MetadataStorage`).
- [ ] All existing snapshot tests pass unchanged.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build`, `pnpm arch:cycles`
      pass (no new cycles).

## Refactor order

1. Extract `ColumnMapper`.
2. Extract expanders one strategy at a time, re-running snapshot tests after each.
3. Add injected-model overloads.

## Notes

Keep canonical sorting in the coordinator (not scattered in expanders) so deterministic
JSON output is guaranteed in one place.
