---
status: not-started
phase: phase-x
package: integration-nestjs
priority: P3
effort: L
risk: medium
category: architecture
depends_on: ["integration-nestjs/task-1.md"]
related: ["plugin-multi-tenant/task-2.md"]
---

# Refactor: Design the NestJS integration surface (if implement is chosen)

## Problem

If `task-1` chooses "implement", the package needs a real design. Today there is nothing to build on —
no module, no DI providers, no request-scope strategy.

## Evidence

- `packages/integration-nestjs/src/index.ts:1-2` — empty stub (no `DynamicModule`, no providers).
- `packages/integration-nestjs/package.json` — no `@nestjs/*` dependency to integrate against.
- The ORM exposes `DbContext` (`@ts-linq/orm`) and provider config (`@ts-linq/core`) that an
  integration would wrap.

## Why this is bad

- Without a design, an implementation will likely reach into ORM internals (the same coupling problem
  the plugins exhibit) instead of using clean public entry points.

## Target architecture

A clean NestJS adapter (Ports & Adapters at the framework boundary):

- `TsLinqModule.forRoot(config)` / `forRootAsync(...)` → a `DynamicModule` exposing a `DbContext`
  provider via DI tokens (Dependency Inversion: consumers inject an interface/token, not a concrete).
- **Request-scoped** `DbContext` (or a request-scoped unit-of-work) using NestJS scopes +
  `AsyncLocalStorage`, so per-request state (transaction, tenant, current user) is isolated. This
  directly reuses the ambient-context work from `plugin-multi-tenant/task-2`.
- Optional decorators (`@InjectDbContext()`, `@InjectRepository(Entity)`).
- Integration ONLY through ORM public entry points — no reaching into `orm`/`core` internals.

## Proposed refactor

1. Add `@nestjs/common`/`@nestjs/core` as peer deps; `reflect-metadata` as needed.
2. Define DI tokens + `DynamicModule` factory (`forRoot`/`forRootAsync`).
3. Implement request scope via Nest `Scope.REQUEST` + ambient context for current user/tenant.
4. Wire lifecycle plugins (audit/tenant) through the request-scoped context (per `_shared/task-1`).
5. Provide a minimal NestJS example app (could live in `examples`, per `examples/task-1`).

## Suggested design patterns

- **Ports & Adapters** (framework boundary), **Dependency Inversion** (inject tokens/interfaces),
  **Unit of Work** (request-scoped DbContext), **Factory** (`forRootAsync`), **Ambient Context**
  (AsyncLocalStorage for per-request state).

## Testing plan

- **Integration:** boot a Nest `TestingModule`, resolve `DbContext`, assert request scoping isolates
  two simulated requests.
- **Contract:** integration uses only public ORM entry points (lint/dep-cruiser boundary check).
- **e2e:** a sample controller performing a query against a real provider.

## Acceptance criteria

- [ ] `forRoot`/`forRootAsync` `DynamicModule` provided.
- [ ] Request-scoped `DbContext` with isolated per-request state.
- [ ] No imports of ORM/core internals (only public entry points).
- [ ] Integration + e2e tests pass; changeset added.

## Refactor order

1. Peer deps + tokens. 2. Module factory. 3. Request scope + ambient context. 4. Plugin wiring.
5. Example + tests.

## Notes

Only proceed if `task-1` = implement. The request-scope design is the hard part and shares
infrastructure with `plugin-multi-tenant/task-2`.
