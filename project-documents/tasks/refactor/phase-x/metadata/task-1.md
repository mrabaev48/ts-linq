---
status: completed
phase: phase-x
package: metadata
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: ['core/task-2.md']
---

# Refactor: Introduce a `MetadataSource` read-port and contain the `MetadataStorage` singleton

## Problem
`MetadataStorage` is a process-wide singleton (`getInstance()`) whose *static forwarding
API* is consumed directly across packages (notably the core loading layer, see
`core/task-2`). The singleton's read methods and the per-instance `MetadataRegistry` share
no common interface, so consumers cannot depend on an abstraction — they must depend on
either the concrete singleton or the concrete registry. This couples high-level code to a
global and prevents clean dependency inversion.

## Evidence
- `packages/metadata/src/MetadataStorage.ts:50` `class MetadataStorage` with `_defaultRegistry` static (line 51) and ~25 static forwarders (lines 85-139).
- `packages/metadata/src/MetadataRegistry.ts:35` `class MetadataRegistry` — the real store; no `implements <interface>`.
- Consumers reference the singleton statically: `core/src/loading/{EntityLoader,RelationshipLoader,LazyLoadingProxy,LazyProxyTraps}.ts` call `MetadataStorage.getEntity(...)` (verified by grep).
- `MetadataStorage` doc itself (lines 22-49) acknowledges the singleton is a fallback and recommends `createMetadataRegistry()` for isolation — but no read-port ties them together.

## Why this is bad
- **Dependency inversion**: nothing to depend on except concretes (singleton or registry).
- **Testability**: consumers must reset global state between tests.
- **Multi-tenant correctness**: there is no type that says "I need a metadata source" — so code defaults to the global.

## Target architecture
Define a `MetadataSource` read interface (`getEntity`, `getEntities`, `getValidationRules`,
`getOwnedEntities`, `getStoredProcedureMapping`) in `@ts-linq/metadata` (or `@ts-linq/types`
to avoid a core→metadata type dependency). `MetadataRegistry implements MetadataSource`.
`MetadataStorage.getInstance()` returns a `MetadataRegistry` (already does) and is positioned
strictly as the *default* source supplied at composition roots — never referenced inside
library internals.

## Proposed refactor
1. Extract `interface MetadataSource` (read-only) + optionally `MetadataSink` (write) for decorator/fluent registration.
2. `MetadataRegistry implements MetadataSource, MetadataSink`.
3. Export `MetadataSource` from the package entrypoint.
4. Update consumers (core loaders) to accept `MetadataSource` (tracked under `core/task-2`).
5. Keep `MetadataStorage` static API for decorator call-sites (they run at module load) but document it as the default-source provider only.

## Suggested design patterns
- **Ports-and-Adapters** — `MetadataSource` is the port; `MetadataRegistry` the adapter.
- **Interface Segregation** — separate read (`MetadataSource`) from write (`MetadataSink`).
- **Facade** — `MetadataStorage` stays a thin facade over the default registry.

## Testing plan
- Unit: `MetadataRegistry` satisfies `MetadataSource` (type-level) and behaves identically through the interface.
- Contract: a fake `MetadataSource` can substitute the registry in consumer tests.
- Regression: decorator registration through `MetadataStorage` static API unchanged.

## Acceptance criteria
- [x] `MetadataSource` (and `MetadataSink`) interfaces exist and are exported.
- [x] `MetadataRegistry implements MetadataSource` (and `MetadataSink`).
- [x] No new circular dependency introduced (verify `arch:cycles`).
- [x] Cluster validations pass.

## Refactor order
Do first in metadata; it is the prerequisite for `core/task-2` (loader DI).

## Notes
Placing `MetadataSource` in `@ts-linq/types` (which has zero deps) avoids forcing core to import metadata just for the type. Confirm the dependency direction with `arch:deps`.

## Outcome (completed)
- **Placement decision:** both ports live in `@ts-linq/types` (`src/metadata.ts`), exported
  via the existing barrel. Confirmed via `pnpm arch:deps` (832 modules, 0 violations) and
  `pnpm arch:cycles` (clean). `@ts-linq/types` is zero-dep, so no `core → metadata` type
  dependency is forced; `@ts-linq/metadata` re-exports both ports from its entrypoint for
  ergonomics.
- **`MetadataSource`** (read, 5 methods): `getEntity`, `getEntities`, `getValidationRules`,
  `getOwnedEntities`, `getStoredProcedureMapping`. **`MetadataSink`** (write): the full
  public registration surface of `MetadataRegistry` (add*/mergeFluent*/setFluent*/set*).
  Signatures mirror `MetadataRegistry` exactly (`target: Function`) — zero behaviour change.
- **`MetadataRegistry implements MetadataSource, MetadataSink`** — no method body changes.
- **`MetadataStorage`** static API and decorator registration unchanged; its class TSDoc now
  documents it as the **default-source provider only** (never referenced inside internals).
- **New DAG edge** inside `@ts-linq/types`: `metadata.ts → stored-procedure.ts` (acyclic —
  `stored-procedure.ts` depends only on `sql.ts`).
- **Tests:** `packages/metadata/tests/MetadataSource.test.ts` — type-level conformance
  (`satisfies`), unit (identical reads through the port), contract (fake `MetadataSource`
  substitutes the registry), regression (decorator/static registration unchanged).
- **Validation:** typecheck, lint, build, unit (2982), integration (464), e2e (290),
  `arch:deps`, `arch:cycles`, `arch:dead` all green.
- **Follow-up:** core loader DI is tracked under `core/task-2` (inject `MetadataSource` into
  `EntityLoader`/`RelationshipLoader`/`LazyLoadingProxy`); the port shape here matches its
  needs (`getEntity`, `getEntities`).
