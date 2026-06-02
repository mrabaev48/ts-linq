---
status: not-started
phase: phase-x
package: core
priority: P0
effort: L
risk: high
category: architecture
depends_on: []
related: ['core/task-3.md', 'metadata/task-1.md']
---

# Refactor: Break hidden `MetadataStorage` singleton coupling in the loading layer

## Problem
The loading layer reaches directly into the process-wide `MetadataStorage` singleton
instead of receiving a metadata source via constructor injection. This hard-wires the
loaders to global mutable state and defeats the multi-tenant / per-context isolation
that `MetadataRegistry` was explicitly designed to provide (see `MetadataRegistry`
class doc, `packages/metadata/src/MetadataRegistry.ts:35` "Isolated, injectable metadata store").

A `DbContext` constructed with an explicit `registry` (per the documented multi-tenant
flow in `packages/metadata/src/MetadataStorage.ts:36-46`) will still have its eager/lazy
loaders silently read from the *global* singleton, not from the context's registry —
a correctness hazard for multi-tenant setups.

## Evidence
- `packages/core/src/loading/EntityLoader.ts:1` — `import { MetadataStorage } from '@ts-linq/metadata'`; used at lines 103, 142, 217, 499.
- `packages/core/src/loading/RelationshipLoader.ts:1` — same import; `MetadataStorage.getEntity(...)` at lines 32, 73, 102, 142, 212, 327.
- `packages/core/src/loading/LazyLoadingProxy.ts:1,39,114` — `MetadataStorage.getEntity(...)`.
- `packages/core/src/loading/LazyProxyTraps.ts:1` — imports the type but couples generics to the singleton accessor.
- Contrast: `EntityLoader` constructor (`EntityLoader.ts:22`) accepts a `provider` and a `logger` but **no** metadata source.

## Why this is bad
- **Multi-tenant isolation broken**: documented `DbContextOptions.registry` isolation does not extend to relationship loading.
- **Testability**: every loader test must mutate the global singleton (`MetadataStorage.reset()`), causing cross-test order dependence.
- **Dependency inversion violated**: a high-level service (loader) depends on a concrete global, not on an abstraction.
- **Debugging risk**: which registry a load used is implicit and invisible.

## Target architecture
Introduce a small `MetadataSource` port (read interface: `getEntity(ctor)`,
`getEntities()`), implemented by `MetadataRegistry`. Inject it into all loaders via
constructor. `MetadataStorage.getInstance()` becomes just the *default* implementation
passed when no explicit registry is supplied — never referenced inside the loaders.

This applies Dependency Inversion (loaders depend on the `MetadataSource` abstraction)
and removes a Service Locator anti-pattern in favour of constructor injection.

## Proposed refactor
1. Define `interface MetadataSource { getEntity(t: Function): EntityMetadata | undefined; getEntities(): EntityMetadata[]; }` in `@ts-linq/metadata` (or `@ts-linq/types`).
2. Make `MetadataRegistry implements MetadataSource`.
3. Add a `metadata: MetadataSource` constructor parameter to `EntityLoader`, `RelationshipLoader`, `LazyLoadingProxy.create`/`createMany`/`preloadRelationships`.
4. Replace every `MetadataStorage.getEntity(...)` in the loading dir with `this._metadata.getEntity(...)`.
5. At the composition root (`DbContext`), pass `options.registry ?? MetadataStorage.getInstance()`.
6. Migration: keep a backward-compatible default param `= MetadataStorage.getInstance()` on public entry points so existing callers compile; deprecate the implicit default.

## Suggested design patterns
- **Dependency Injection / Ports-and-Adapters** — `MetadataSource` is the port; `MetadataRegistry` the adapter.
- **Strategy** — different registries (tenant A vs B) are interchangeable sources.
- **Null Object** — an `EmptyMetadataSource` for tests that need a guaranteed-empty source.

## Testing plan
- Unit: construct `EntityLoader` with an in-memory fake `MetadataSource`; assert no reliance on the global singleton (spy that `MetadataStorage.getInstance` is never called).
- Integration: two `DbContext`s with different registries load relationships from their own registry.
- Regression: existing lazy/eager loading tests pass with the default source.

## Acceptance criteria
- [ ] No `import { MetadataStorage }` remains in `packages/core/src/loading/*`.
- [ ] All loaders accept an injected `MetadataSource`.
- [ ] `DbContext` wires `options.registry` into loaders.
- [ ] New test proves two registries stay isolated through loading.
- [ ] Cluster validations pass.

## Refactor order
Do early — it unblocks honest unit testing of the loaders (`core/task-3`) and aligns with `metadata/task-1` (singleton boundary). Pairs with the `MetadataSource` port introduction.

## Notes
The prior known-evidence mentioned `SequenceRegistry` leaking into core/loading. Verified false in the current tree: `grep` shows `SequenceRegistry` is **not** imported anywhere under `packages/core/src` — it is used only in `packages/migrations/src/SchemaSnapshot.ts` and `packages/orm/src/ModelBuilder.ts`. That coupling is out of this cluster's scope; only `MetadataStorage` leaks into core here.
