# refactor/orm/task-4 — Split ChangeTracker responsibilities ✅ DONE

orm's 4TH task (branch `audit-refactor/orm-split-change-tracker`). God class
`ChangeTracker` (648 LOC) → composing **facade** (133 code LOC / 289 w/ JSDoc, well
under <250 target) over focused collaborators in `packages/orm/src/changetracker/`.

## New collaborators (all internal, NOT barrel-exported)
- `EqualityComparer.ts` — `EqualityComparer` interface + `DeepEqualityComparer` +
  `defaultEqualityComparer` singleton (Strategy). SINGLE equality definition:
  consolidated `areObjectsEqual` + `complexDeepEquals` (key-order-insensitive, Date by
  getTime, null/undefined strict). `complexValueComparer.complexDeepEquals` now DELEGATES
  to it (one impl). ChangeDetector also routes complex-prop compare through the injected
  comparer (per-column `col.comparer` stays an override = EF Core semantics).
- `SnapshotStore.ts` — `clone()` = structuredClone(JSON fallback) + comparer.snapshot +
  complexSnapshot. (was cloneObject/baseClone)
- `ShadowValueStore.ts` — WeakMap get/set/getAll (P1-16 shadow values).
- `ChangeDetector.ts` — detectChanges/hasChanged/hasShadowChanged over injected
  EqualityComparer + ShadowValueStore.
- `SkipNavigationTracker.ts` — owns `_collectionSnapshots`; snapshot/forget/clear/
  collectChanges (m2m diff). **`JoinRowChange` interface MOVED here**, re-exported from
  ChangeTracker.ts (`export type { JoinRowChange }`) for back-compat (barrel `export *`).
  Dropped dead `currentItemsByPk` map.
- `GraphTracker.ts` — trackGraph + nodeFactory over GraphIterator; depends on narrow
  `GraphStatePort {getEntityState,setState}` (ChangeTracker passes `this`).
- `EntityStateMachine.ts` — owns `_trackedEntities` Map + add/update/remove/attach/
  setState/acceptAllChanges/getChanges/getEntityState/getTrackedForType/clear/findByValues;
  ctor(identityMap, snapshots, skipNav, observer); emits to ITrackedEntityObserver.
- `TrackedIdentityMap.ts` — owns `_trackedByPk`; register/unregister/findByPk/findByValues/
  clear. Composite-PK keying via shared `pkKey.ts`.
- `pkKey.ts` — `pkTupleFromEntity` (sorted PK names) + `pkTupleFromValues` (raw values,
  alphabetical order). SINGLE keying impl.
- `ITrackedEntityObserver.ts` — `onTracked/onSync` (Observer). `LocalViewRegistry.ts`
  IMPLEMENTS it + owns the `entityClass→LocalView` map + getOrCreate seeding. Inline
  `notifyLocalView` fan-out GONE; state machine emits to the registry-as-observer.
- `IChangeTrackerForEntry.ts` — narrow port {getEntityState,setState,getShadowValue,
  setShadowValue}. `EntityEntry`/`PropertyEntry` now depend on THIS, not concrete
  ChangeTracker → breaks the `ChangeTracker↔EntityEntry` cycle.
- `EntryFactory.ts` (type) + `defaultEntryFactory.ts` (Abstract Factory). ChangeTracker
  holds `_entryFactory = defaultEntryFactory`, `setEntryFactory()` for DI/testing.

## ChangeTrackerFacade REMOVED (user chose full removal = breaking)
findEntry/entries moved ONTO ChangeTracker (use _entryFactory). `ChangeTrackerFacade.ts`
deleted; `export { ChangeTrackerFacade }` removed from index.ts. Migrated consumers
(ChangeTrackerFacade→ChangeTracker): DbContextBootstrapper (`new ChangeTracker`),
DbContextServices, SavePipeline.types (incl `SaveChange = ReturnType<ChangeTracker['getChanges']>`),
DbContext getters. Migrated test `tests-new/LocalViewFindEntry.test.ts`.

## Reconciliation
Public `src/IdentityMap.ts` (NoTracking, was single-PK raw key, UNUSED internally) now
keys via shared `pkTupleFromEntity` → composite support, no duplicate keying impl.

## Gotchas
- EntityEntry ctor 4th param type widened ChangeTracker→IChangeTrackerForEntry (interface
  not barrel-exported; OK — private field, .d.ts uses relative import-type, build passes).
- `new ChangeTracker()` bare works (default factory) → most tracker tests untouched.
- Validation ALL green: typecheck, lint (0 err/266 pre-existing warn), unit 3719,
  integration 461, e2e 290, build, arch:deps, **arch:cycles (facade cycle GONE, no new)**,
  arch:dead. New tests `tests-new/changetracker/*.test.ts` (6 suites). `Array.at` not in
  test lib target — use index access.
- changeset **major → orm 5.0.0** (only orm bumped). **orm stays In Progress; next orm = task-5**
