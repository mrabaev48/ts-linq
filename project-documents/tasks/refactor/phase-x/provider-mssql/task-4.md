---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: M
risk: medium
category: provider
depends_on: []
related: ["provider-mysql/task-4.md", "provider-postgres/task-4.md"]
---

# Refactor: Introduce explicit `ProviderCapabilities` instead of runtime `if (!dialect.buildInsert) throw`

## Problem
Providers discover missing dialect features at runtime by probing optional methods and throwing
a generic `Error`. This is a silent feature-gap model: the gap only surfaces when a user happens
to call the operation, with no compile-time guarantee and no discoverable capability surface.

## Evidence
- `packages/provider-postgres/src/PostgresProvider.ts:209` `if (!dialect.buildInsert) throw new Error('Dialect does not support buildInsert');` — repeated at `:230` (buildUpdate), `:303` (buildDelete).
- `packages/provider-mysql/src/MySqlProvider.ts:155` (buildInsert), `:200` (buildUpdate), `:257` (buildDelete).
- MSSQL casts the dialect instead and assumes the method exists: `MssqlProvider.ts:204` `const dialect = this.getDialect() as MssqlDialect;` then calls `dialect.buildInsert(...)` at `:205` with no guard — an inconsistent third behavior.
- Savepoint capability differs silently per provider: MSSQL `releaseSavepoint` is a no-op (`MssqlProvider.ts:541`) while MySQL implements it (`MySqlProvider.ts:450`); nothing advertises this.

## Why this is bad
- Interface Segregation / Liskov tension: callers cannot rely on a uniform provider contract; behavior depends on undocumented optional methods.
- Runtime `throw new Error(string)` is untyped and not in the ORM error hierarchy.
- Three different handling styles (PG guard, MySQL guard, MSSQL cast-and-assume) for the same concern.
- No way for higher layers (query/orm) to branch on capabilities (e.g. RETURNING vs identity readback).

## Target architecture
Add an explicit, immutable `ProviderCapabilities` **capability object** exposed by each provider
(e.g. `getCapabilities(): ProviderCapabilities`) declaring booleans such as `supportsReturning`,
`supportsMerge`, `supportsReleaseSavepoint`, `supportsServerSideExplainJson`, etc. Replace ad-hoc
probes with capability checks that throw a typed `UnsupportedFeatureError` (new, in the ORM error
hierarchy) when a required capability is absent. SOLID: ISP (capabilities are explicit and
queryable), OCP (new capabilities added declaratively), DIP (consumers depend on the capability
contract, not on `typeof dialect.method`).

## Proposed refactor
1. Define `ProviderCapabilities` in `@ts-linq/types` and a typed `UnsupportedFeatureError`.
2. Each provider returns a frozen capabilities object.
3. Replace `if (!dialect.buildX) throw` and the MSSQL cast-and-assume with a single guarded path that consults capabilities and throws the typed error.
4. Advertise savepoint-release support so higher layers stop guessing.

## Suggested design patterns
- **Capability object / Marker interface** — explicit, queryable feature surface.
- **Strategy** — capability-driven branching replaces type-probe branching.

## Testing plan
- Unit: a fake provider with a capability cleared throws `UnsupportedFeatureError` (not a bare `Error`).
- Unit: each real provider's capability object matches its implemented methods.
- Regression: existing CRUD paths unaffected when capabilities are present.

## Acceptance criteria
- [ ] `ProviderCapabilities` type and `UnsupportedFeatureError` exist in the ORM error hierarchy.
- [ ] All `if (!dialect.buildX) throw new Error(...)` probes are replaced by capability checks.
- [ ] MSSQL's cast-and-assume is replaced by the same capability-guarded path.
- [ ] Savepoint-release capability is advertised correctly per provider.
- [ ] Unit tests cover present/absent capability behavior.

## Refactor order
Can precede `task-1.md`; reduces hidden branching before the god-class split.

## Notes
Cross-cutting; filed under mssql because its cast-and-assume is the most dangerous variant.
See `provider-mysql/task-4.md` and `provider-postgres/task-4.md`.
