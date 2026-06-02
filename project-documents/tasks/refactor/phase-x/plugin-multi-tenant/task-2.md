---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P1
effort: M
risk: high
category: architecture
depends_on: ["_shared/task-1.md"]
related: ["integration-nestjs/task-1.md"]
---

# Refactor: Request-scoped tenant context instead of shared mutable state

## Problem

`MultiTenantMiddleware` holds the current tenant in a per-instance mutable field. A single middleware
instance shared across concurrent requests (the normal case for a long-lived ORM/provider) will leak
one request's tenant into another.

## Evidence

- `packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:10` — `private currentTenant?: string | number;`
- `setTenant` (line 25), `clearTenant` (line 122), and `getTenant` (line 33) read/write this single
  field. `getTenant` prefers `this.currentTenant` over the resolver (line 33-35).
- There is no scoping mechanism (no AsyncLocalStorage, no per-context instance) — the field is plain
  instance state.

## Why this is bad

- **Concurrency hazard / race condition:** request A calls `setTenant(A)`, awaits I/O; request B calls
  `setTenant(B)`; request A resumes and now stamps/filters with tenant B → cross-tenant write or read.
- This is the canonical reason EF-style tenant providers use ambient request scope, not a setter on a
  shared object.
- Couples correctness to an undocumented "create one instance per request" assumption that nothing
  enforces.

## Target architecture

Ambient, request-scoped tenant context via `AsyncLocalStorage` (Node) or an injected
`TenantContextAccessor` abstraction (Dependency Inversion), so the tenant is read from the active
async context, not a shared field. The `getCurrentTenant` resolver stays the integration seam
(e.g. NestJS request scope, see `integration-nestjs/task-1`).

## Proposed refactor

1. Replace the `currentTenant` field + `setTenant`/`clearTenant` with a `TenantContextAccessor`
   abstraction backed by `AsyncLocalStorage`.
2. Provide a `runWithTenant(tenantId, fn)` scope helper (this is what `createTenantScope` *pretends*
   to be — see task-3).
3. `getTenant` reads the ambient context first, then the resolver.
4. Document that the plugin is safe under concurrency.

## Suggested design patterns

- **Ambient Context / AsyncLocalStorage**, **Dependency Inversion** (accessor abstraction),
  **Scoped Execution** (`runWithTenant`).

## Testing plan

- Interleaved-async test: two concurrent `runWithTenant` scopes never cross-contaminate.
- Resolver fallback when no ambient scope is active.

## Acceptance criteria

- [ ] No shared mutable `currentTenant` field used across requests.
- [ ] Tenant is read from ambient/request scope.
- [ ] Concurrency interleave test passes.
- [ ] `runWithTenant`-style scoping replaces `setTenant`/`clearTenant`.

## Refactor order

1. Accessor abstraction. 2. AsyncLocalStorage backing. 3. Scope helper. 4. Concurrency tests.

## Notes

Directly enables a correct NestJS request-scoped integration (`integration-nestjs/task-1`).
