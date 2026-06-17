---
status: completed
phase: phase-x
package: orm
priority: P1
effort: L
risk: medium
category: architecture
depends_on: []
related: ["task-1.md"]
---

# Refactor: Split `ChangeTracker` responsibilities

## Problem

`packages/orm/src/ChangeTracker.ts` (648 LOC) is a multi-concern class that owns
six independent responsibilities behind one type:

1. **Identity map** — `_trackedByPk`, `getPkTuple`/`getPkMap`/`findByPk`/
   register/unregister (lines 41–123, 306–313).
2. **State machine** — `add`/`update`/`remove`/`attach`/`setState`/
   `acceptAllChanges`/`getChanges`/`getEntityState` (134–261, 389–412).
3. **Shadow property store** — `_shadowValues` WeakMap + get/set/getShadowValues
   (46–47, 414–434).
4. **Change detection / equality** — `detectChanges`, `hasChanged`,
   `hasShadowChanged`, `areObjectsEqual`, `cloneObject`, `baseClone` (442–489,
   582–647).
5. **Skip-navigation (m2m) collection diffing** — `_snapshotCollections`,
   `collectSkipNavigationChanges` (493–580).
6. **Graph traversal** — `trackGraph` with an inline `nodeFactory` building
   getter/setter `ITrackGraphEntry` objects (346–383).

Plus LocalView notification fan-out woven through every mutator
(`notifyLocalView`, lines 127–132 and call sites).

`ChangeTrackerFacade` (a subclass) adds the `EntityEntry`-returning API only to
dodge a circular import — itself a smell indicating the layering is wrong.

## Evidence

- Six responsibility clusters enumerated above with line ranges.
- Private deep-equality (`areObjectsEqual`, 630–647) duplicates value-comparison
  logic that also exists for complex types (`complexDeepEquals`) and column
  comparers — three equality mechanisms in one method body (464–489).
- `cloneObject` (584–612) mixes structuredClone, comparer snapshotting, and
  complex-type snapshotting.
- Inheritance-for-circular-import workaround (`ChangeTrackerFacade.ts:6-15`).

## Why this is bad

- The class is on the `saveChanges` hot path yet impossible to unit-test in
  slices (identity map, detection, m2m diffing all share private state).
- Equality logic is scattered and partially duplicated; a bug in one path
  (e.g. key-order sensitivity) is hard to localize.
- Using subclassing to break a cycle couples the facade to the full
  implementation and hides the true dependency direction.
- Adding a new tracking concern (e.g. temporal snapshots) means editing the god
  class.

## Target architecture

Apply SRP + composition behind a stable facade (dependency inversion):

- **`IdentityMap`** — pk-tuple indexing; sole owner of `_trackedByPk` and
  `getPkTuple`. (Note: a separate `src/IdentityMap.ts` already exists and is
  exported — reconcile/merge rather than create a parallel one.)
- **`EntityStateMachine`** — owns `_trackedEntities` and the state transitions
  (`add/update/remove/attach/setState/acceptAllChanges`), emitting change events
  consumed by LocalViews via an observer, not a hard-wired `notifyLocalView`.
- **`SnapshotStore`** — `cloneObject`/`baseClone`/comparer + complex snapshots.
- **`ChangeDetector`** — `detectChanges`/`hasChanged`/`hasShadowChanged`, using a
  single injected `EqualityComparer` strategy (consolidate `areObjectsEqual` +
  `complexDeepEquals` + column comparers).
- **`ShadowValueStore`** — the WeakMap + accessors.
- **`SkipNavigationTracker`** — collection snapshotting + diffing.
- **`GraphTracker`** — `trackGraph` + node factory.
- **`ChangeTracker` facade** composes these and exposes the public API
  (eliminating the `ChangeTrackerFacade` subclass; resolve the `EntityEntry`
  cycle by depending on an `EntityEntry` factory interface, not the concrete
  class).

## Proposed refactor

1. Introduce an `EqualityComparer` strategy and route all equality through it.
2. Extract `SnapshotStore`, `ShadowValueStore`, `ChangeDetector`,
   `SkipNavigationTracker`, `GraphTracker` as collaborators.
3. Replace `notifyLocalView` hard-wiring with an `ITrackedEntityObserver`
   (LocalView subscribes); state machine emits.
4. Merge identity-map logic with the existing `src/IdentityMap.ts`.
5. Collapse `ChangeTrackerFacade` into `ChangeTracker` using an injected
   `entryFactory(entity, cls, provider, tracker) => EntityEntry` to break the
   cycle (Abstract Factory), removing the subclass-for-cycle workaround.
6. Keep the public method set identical; only internal composition changes.

## Suggested design patterns

- **Strategy** (`EqualityComparer`) — one equality definition, swappable, testable.
- **Observer** (`ITrackedEntityObserver`) — decouples LocalView from the tracker.
- **Abstract Factory** (`entryFactory`) — breaks the `ChangeTracker`↔`EntityEntry`
  cycle without inheritance.
- **Facade** — `ChangeTracker` composes the parts behind a stable API.

## Testing plan

- **Unit:** each collaborator in isolation (identity map composite-PK keys,
  detector with/without comparers, m2m diffing add/remove, graph BFS cycle
  safety).
- **Regression:** `tests/tracking.test.ts`, `tests-new/ChangeTracker.test.ts`,
  `tests/track-graph.test.ts`, `tests/skip-navigation-change-tracker.test.ts`,
  `tests-new/LocalViewFindEntry.test.ts`, `tests-new/ShadowProperties.test.ts`
  must pass unchanged.
- **Equality regression:** key-order insensitivity and Date-by-time cases.

## Acceptance criteria

- [ ] `ChangeTracker.ts` reduced to a composing facade (target < 250 LOC).
- [ ] Single `EqualityComparer` strategy used by all change detection.
- [ ] LocalView updates flow through an observer, not inline `notifyLocalView`.
- [ ] `ChangeTrackerFacade` subclass-for-cycle removed (cycle broken via factory).
- [ ] Identity-map logic reconciled with `src/IdentityMap.ts` (no duplicate impl).
- [ ] All listed test suites pass; `pnpm arch:cycles` shows no new cycles.

## Refactor order

1. `EqualityComparer` + route detection through it.
2. `SnapshotStore` + `ShadowValueStore`.
3. `SkipNavigationTracker` + `GraphTracker`.
4. Observer-ize LocalView.
5. Collapse facade via `entryFactory`.

## Notes

The existing exported `src/IdentityMap.ts` must be inspected during step 5 to
avoid two competing identity-map implementations.
