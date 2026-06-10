---
status: completed
phase: phase-x
package: core
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ['core/task-2.md']
related: ['core/task-9.md']
---

# Refactor: Split the `EntityLoader` god class and its duplicated batched/single load paths

## Problem
`packages/core/src/loading/EntityLoader.ts` (~592 LOC, class `EntityLoader` at line 13)
mixes three concerns and contains near-duplicated logic for the "single entity" and
"batched many" code paths:

- Strategy selection (`loadEntity`/`loadEntities`, lines 45-92).
- Per-relationship dispatch by type (`loadRelationshipByType`, `loadRelationshipBatchedByType`, lines 376-444).
- Concrete loading + IN()-chunking + grouping (`loadToOne`/`loadOneToMany`/`loadToOneBatched`/`loadOneToManyBatched`/`populateFilteredRelationshipsMany`, lines 328-589).

The single and batched implementations duplicate FK resolution, chunking, grouping, and
assignment. There is also overlap with `RelationshipLoader` (which independently
implements one-to-one/one-to-many/many-to-many loading) — two parallel loaders with
divergent behaviour.

## Evidence
- `EntityLoader.ts:446` `loadToOneBatched` and `EntityLoader.ts:518` `loadOneToManyBatched` repeat the same chunk-IN loop (`uniqueX.length <= chunkSize` … else slice loop) found also in `populateFilteredRelationshipsMany` (lines 239-255).
- `defaultForeignKeyFor` is duplicated in `EntityLoader.ts:297` **and** `RelationshipLoader.ts:341`.
- `resolveTargetEntity` is duplicated in `EntityLoader.ts:282` **and** `RelationshipLoader.ts:333`.
- Heavy `as unknown as { … }` relationship casts (`EntityLoader.ts:122-127`, `163-169`) instead of a typed relationship shape.

## Why this is bad
- **Maintainability**: a chunking or grouping bug must be fixed in 3+ places.
- **Extensibility**: adding a relationship kind (e.g. many-to-many to `EntityLoader`) means touching multiple parallel branches.
- **Consistency risk**: `EntityLoader` and `RelationshipLoader` can drift (e.g. one applies proxies, the other does not).
- **Type safety**: `as unknown as` casts hide the real relationship contract from the compiler.

## Target architecture
Extract a `RelationshipLoadStrategy` per relationship kind (one-to-one, many-to-one,
one-to-many, many-to-many) behind a common interface, each implementing both
`loadSingle` and `loadBatch`. Extract shared mechanics (`InClauseChunker`,
`ForeignKeyConvention`, `TargetEntityResolver`, `EntityGrouper`) as small reusable
collaborators shared by both `EntityLoader` and `RelationshipLoader`, eliminating the
duplication.

## Proposed refactor
1. Create `InClauseChunker` (wraps `provider.findWhereIn` chunking + `crossQuery` logging).
2. Create `ForeignKeyConvention.defaultFor(ctor)` and `TargetEntityResolver.resolve(target)` shared utilities (remove the two duplicate copies).
3. Define `interface RelationshipLoadStrategy { loadSingle(...); loadBatch(...); }`; one impl per kind; register in a dispatch map keyed by `relationship.type` (replaces the `if/else` chains).
4. `EntityLoader` becomes an orchestrator selecting strategy + applying includes/depth.
5. Replace `as unknown as {…}` relationship casts with a shared typed `LoadableRelationship` view derived from `RelationshipMetadata`.
6. Consider merging `RelationshipLoader` into the strategy set so there is a single loading code path (proxy-aware vs not handled by a flag/decorator).

## Suggested design patterns
- **Strategy** + **Factory/Registry (dispatch map)** for per-relationship-kind loading.
- **Template Method** for the shared "fetch → group → assign → recurse" skeleton.
- **Extract Class** for `InClauseChunker`, `EntityGrouper`.
- **Composition over inheritance** for sharing mechanics across loaders.

## Testing plan
- Unit: each `RelationshipLoadStrategy` with a fake provider (assert SQL fan-out shape, grouping, depth recursion).
- Unit: `InClauseChunker` boundary cases (size == chunk, size > chunk, empty).
- Regression: eager-load N+1 batching behaviour and `populateFilteredRelationshipsMany` filter application.
- Type-level: removal of `as unknown as` does not widen the relationship contract.

## Acceptance criteria
- [ ] `defaultForeignKeyFor` and `resolveTargetEntity` exist once, shared.
- [ ] Chunk-IN logic exists once (`InClauseChunker`).
- [ ] `EntityLoader` no longer contains per-kind `if (type === 'one-to-many')` branching.
- [ ] `as unknown as` relationship casts removed in favour of a typed view.
- [ ] Cluster validations pass; N+1 batching tests unchanged.

## Refactor order
After `core/task-2` (injected `MetadataSource`) so strategies receive the source explicitly. Coordinate with `core/task-9` (RelationshipLoader raw-SQL fix) since both touch the loading dir.

## Notes
Decide whether `RelationshipLoader` and `EntityLoader` should fully unify or stay split by proxy-awareness; document the decision in Serena memory. The trailing comment "DbSetWithIncludes was removed" (`EntityLoader.ts:592`) suggests prior churn here — confirm no dead include API remains.
