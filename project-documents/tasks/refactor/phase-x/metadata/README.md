# Refactor Audit: metadata

## Package responsibility
`@ts-linq/metadata` owns the runtime entity-metadata model: the injectable
`MetadataRegistry` store, the process-wide `MetadataStorage` singleton facade,
`EntityMetadataBuilder`, pending-metadata collection, value converters/comparers,
property-access abstractions, compiled-model hydration, sequence registry, and
stored-procedure mapping. It depends only on `@ts-linq/types`.

## Current architectural problems
- ~~**God class `MetadataRegistry`** (~575 LOC) with the identical "finalized-vs-builder" branch duplicated across ~25 mutators and index validation duplicated within one method (task-2).~~ ✅ **resolved (task-2)** — the branch now lives once in `EntityMetadataState.mutate` (Template Method); index validation is a single `validateIndex` helper used by both states; the ~27 mutators are grouped into seven facet stores composed behind the unchanged `MetadataRegistry` facade (~580 → ~290 LOC). `EntityMetadataBuilder` facet alignment deferred (see Notes).
- ~~**Singleton without a port**: `MetadataStorage` global is consumed directly across packages; no `MetadataSource` abstraction to depend on (task-1).~~ ✅ **resolved (task-1)** — `MetadataSource`/`MetadataSink` ports added in `@ts-linq/types`; `MetadataRegistry implements` both. Core loader DI follow-up tracked under `core/task-2`.
- ~~**24 committed build artifacts** (`.d.ts`/`.map`) interleaved in `src` — stale-file trap (task-3).~~ ✅ **resolved (task-3)** — removed; build emits to `dist` only.
- ~~**Silent-swallow control flow** in `getEntity`'s try/catch fallback that diverges metadata shape (task-4).~~ ✅ **resolved (task-4)** — the control-flow `try/catch` is gone; `getEntity` is a single guarded path that always applies `target`-rebasing. Wrapper→original resolution goes through one capability probe (`reflectGetOwnMetadata`, where `undefined` = "no reflect-metadata / no entry"), extracted as `protected resolveOriginal`; an *unexpected* resolution failure now surfaces typed (`MetadataError` with `cause`) via the translation-only `resolveTarget` seam instead of vanishing into a divergent fallback.
- **`Function`-typed keys + `as unknown as` casts** weaken type safety across the model (task-5).

## Refactor goals
- Provide a `MetadataSource`/`MetadataSink` port so consumers depend on abstractions, not the singleton.
- Collapse the duplicated mutate-branch and validation into single helpers; split into facet stores.
- Keep `src` source-only; outputs in `dist`.
- Make metadata resolution deterministic and typed; no silent fallbacks.
- Replace `Function` with a constructor type and remove unsafe casts.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-3 ✅ **completed** | P0 | Remove stale build artifacts first — clears the stale-file trap |
| 2 | task-1 ✅ **completed** | P1 | Introduce `MetadataSource` port (unblocks core DI) |
| 3 | task-2 ✅ **completed** | P1 | Split god class; dedupe mutate-branch + index validation |
| 4 | task-4 ✅ **completed** | P2 | Fix silent-swallow fallback in `getEntity` |
| 5 | task-5 | P2 | Constructor type + remove `as unknown as` |

## Dependencies on other packages
- `@ts-linq/types` — proposed home for `MetadataSource`/`EntityCtor` (zero-dep package keeps direction clean).
- Consumed by `@ts-linq/core` loaders (see `core/task-2`), `@ts-linq/orm`, `@ts-linq/migrations`.

## Testing strategy
- Unit tests per facet store after the split; `mutate()` template behaviour; single-source index validation.
- Contract test that a fake `MetadataSource` substitutes the registry.
- Capability test for the no-`reflect-metadata` environment.
- Type-level tests for `EntityCtor` rejecting non-constructors.
- Regression: full decorator + fluent registration suite unchanged; `pnpm build`/`arch:dead` clean after artifact removal.

## Follow-up (deferred from task-2)
- **`EntityMetadataBuilder` facet alignment** (`EntityMetadata.ts`, ~342 LOC): the pre-finalize
  accumulator still carries the parallel facet sprawl (24 optional fields) and a 30+-line
  conditional spread in `build()` (lines ~289–344). task-2 left it untouched to keep the PR
  focused on the registry seam. Follow-up: mirror the registry's facet grouping onto the builder
  (e.g. a `ColumnSection`/`IndexSection`/… decomposition) and replace the `build()` spread with a
  per-facet `applyTo(metadata)` contribution, so adding a new metadata concern touches one place
  on both sides. Behaviour-preserving; medium effort.

## Notes
`MetadataStorage.getInstance()` is correct to keep as the *default* source for decorator
call-sites (decorators run at module load) — the goal is to stop *library internals* from
referencing it. `SequenceRegistry` here is a second singleton with the same getInstance
pattern; it is consumed by `orm`/`migrations` (out of this cluster) — flag for those clusters
rather than refactoring it from metadata in isolation.
