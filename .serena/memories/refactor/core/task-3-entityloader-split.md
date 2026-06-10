# refactor/core/task-3 — Split EntityLoader + dedup loaders (✅ DONE)

Branch `audit-refactor/core-split-entity-loader`. `@ts-linq/core` **minor**.

## What changed
`EntityLoader` (~628 LOC god class) → thin orchestrator + shared collaborators + per-kind
strategy registry. Both `EntityLoader` (eager) and `RelationshipLoader` (lazy/proxy) now
delegate to the **same** strategy set; their duplicated helpers are gone.

### New units (all `packages/core/src/loading/`, all internal — NOT in barrel)
- `support/ForeignKeyConvention.ts` — `defaultFor(ctor)` (was `defaultForeignKeyFor` ×2).
- `support/TargetEntityResolver.ts` — `resolve(EntityRef)` (was `resolveTargetEntity` ×2).
- `support/InClauseChunker.ts` — `query(provider,ctor,col,vals,chunkSize)`; the IN()-chunk loop
  that was copy-pasted 3× in EntityLoader; `crossQuery` telemetry only on multi-chunk path,
  guarded by `logInternalError` (task-5 channel). Exports `DEFAULT_IN_CHUNK_SIZE=1000`.
- `support/EntityGrouper.ts` — `groupByKey` / `indexByKey` / `uniqueDefined`.
- `support/ColumnResolver.ts` — `primaryKeyColumnName(meta)` / `columnNameForProperty(meta,prop)`.
- `support/LoadableRelationship.ts` — typed view `LoadableRelationship` + `asLoadable(rel)`
  (returns null for string/undefined targetEntity); `ThroughMapping`. **Replaces all
  `as unknown as {…}` relationship casts + the validateIncludes metadata casts** (task-7 overlap).
- `strategies/RelationshipLoadStrategy.ts` — `interface {loadSingle,loadBatch}` +
  `RelationshipLoadContext` (the single seam carrying every behavioural delta).
- `strategies/ToOneStrategy.ts` (one-to-one + many-to-one), `OneToManyStrategy.ts`,
  `ManyToManyStrategy.ts` (junction via `provider.queryJunction`, task-4).
- `strategies/relationshipStrategyRegistry.ts` — `Map<type,strategy>` + `strategyFor(kind)`;
  **replaces all `if (type==='one-to-many')` / `switch` chains** in both loaders.

## Decision: SPLIT + shared mechanics (NOT full-merge)
Two orchestrator classes stay separate because lifecycles genuinely differ:
- `EntityLoader`: eager, depth-recursive, identity wrap, no markLoaded. Context: `wrapOne/Many`
  & `rawTarget` = identity, `markLoaded` = noop, `assignSingle` = real setter, `fetchToOne` =
  recursive `loadEntity(depth-1)`, `absentToMany` = undefined (leave prop untouched),
  `resolveBatchedToOne` = identity, `recurseBatched` = depth-gated `loadRelationshipsBatched`.
- `RelationshipLoader`: lazy/proxy, `wrapOne/Many`+`getRawTarget`+`markLoaded` real, no depth.
  Context: `assignSingle` = noop (returns value for the proxy), `fetchToOne` = `findById`+`wrapOne`,
  `absentToMany` = [], `resolveBatchedToOne` = `v||null`, `recurseBatched` = noop. Context built
  once (`??=` cache).
Rationale: a single strategy family + lightweight context preserves behaviour byte-for-byte
while killing duplication; merging into one orchestrator would force fragile sentinel/policy
threading (skip-vs-default, recursive-vs-return) on a "behaviour must stay identical" task.

## Folded-in improvements (→ minor)
- `EntityLoader` gains **many-to-many eager loading** (previously silently dropped: m2m fell
  through the to-one branch, read a non-existent fk, assigned nothing).
- `RelationshipLoader` gains **IN()-chunking** (it never chunked before) from the shared chunker.

## Behaviour preserved
N+1 batching + `populateFilteredRelationshipsMany` (now uses shared chunker+grouper) unchanged;
single-path error wrap (`RelationshipLoadError`) stays in EntityLoader orchestrator; batched
path stays un-wrapped (as before). No `DbSetWithIncludes` dead API (only the historical comment).

## Gotchas
- `ForeignKeyConvention.defaultFor` param is `new (...args:never[])=>unknown` and reads name via
  `(type as {name?})` — a plain `{name?:string}` param triggers TS2559/2560 ("no properties in
  common") against construct-signature args.
- Strategy types are internal; tsd targets only public `dist/index.d.ts`, so the non-widening
  type guard lives as an inline `@ts-expect-error` in `tests-new/support/loaderSupport.test.ts`
  (ts-jest type-checks).
- eslint --fix reorders imports (support/ before strategies/ alphabetical groups).

## Validation (all green)
typecheck, lint (0 errors), unit 3182, integration 464 (+2 skipped), e2e 290, build,
arch:deps, arch:cycles, arch:dead. New tests: InClauseChunker, loaderSupport,
EntityLoader.manyToMany, RelationshipLoader.chunking.

## Follow-ups
task-7 only partial (loader relationship view done; other core `as unknown as` sites remain);
coordinate task-9 barrel curation (both touch loading dir). See [[refactor/core/task-4-relationship-loader-junction-injection]], [[refactor/core/task-1-databaseprovider-decompose]].
