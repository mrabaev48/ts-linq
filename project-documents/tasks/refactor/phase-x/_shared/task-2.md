---
status: not-started
phase: phase-x
package: _shared
priority: P1
effort: L
risk: medium
category: architecture
depends_on: ["_shared/task-1.md"]
related: ["plugin-audit/task-2.md", "plugin-soft-delete/task-2.md", "plugin-multi-tenant/task-2.md"]
---

# Refactor: Extract a shared plugin-kit to kill template duplication

## Problem

The three plugins are copy-paste siblings. The same four mechanisms are reimplemented verbatim in
each package, so any fix or behavioural change must be made three times and inevitably drifts.

## Evidence

Identical patterns repeated across packages:

- **Option defaulting via constructor spread:**
  - `plugin-audit/src/AuditMiddleware.ts:11-20`
  - `plugin-soft-delete/src/SoftDeleteMiddleware.ts:11-20`
  - `plugin-multi-tenant/src/MultiTenantMiddleware.ts:12-20`
  - Plus a parallel free-function variant `with*` in each `utils.ts`
    (`utils.ts withAudit`/`withSoftDelete`/`withTenant`) duplicating the same defaults a second time.
- **Metadata column probe** copied 4×:
  - `plugin-audit/src/AuditMiddleware.ts:92-99` `hasProperty`
  - `plugin-soft-delete/src/SoftDeleteMiddleware.ts:39-45`
  - `plugin-multi-tenant/src/MultiTenantMiddleware.ts:64-66`
  - and again in `orm/src/services/SoftDeleteInterceptor.ts:41,46-48`.
- **`MetadataStorage.getEntity(...)` + early `return` on missing meta** in all three middlewares.
- **`I<X>Middleware` re-export of a same-named interface** in all three `index.ts`.
- **`get current X` with try/catch swallow** in audit (AuditMiddleware.ts:104-114) and tenant
  (MultiTenantMiddleware.ts:32-46).

## Why this is bad

- **DRY / Single Source of Truth:** the column-probe and default-merge logic each have 4 copies that
  already differ in subtle ways (audit checks property OR column; tenant inlines it; orm interceptor
  re-derives defaults `?? 'isDeleted'`).
- **Open/Closed:** adding a new plugin means re-copying the template instead of composing a kit.
- **Maintainability:** the SQL-injection fix, the immutability fix, and the error-handling fix all
  have to land 3× without a shared home.

## Target architecture

Introduce `@ts-linq/plugin-kit` (or an internal module under `@ts-linq/types`) providing:

- `resolveOptions<T>(defaults, overrides)` — one defaulting helper (replaces 3 constructors + 3 `with*`).
- `EntityColumnProbe` — a small object wrapping `MetadataStorage.getEntity` with
  `hasColumn(entityClass, name)` (Single Responsibility), shared by plugins AND the orm interceptor.
- `CurrentValueProvider<T>` — abstraction for "current user" / "current tenant" with a **Null Object**
  default and an explicit error policy (no bare catch).
- A `mutateEntity` helper that records and returns the set of changes (supports immutability contract,
  see plugin-specific tasks).

Apply **Composition over inheritance**, **DRY**, **Dependency Inversion** (plugins depend on the
probe abstraction, not on `@ts-linq/metadata` directly).

## Proposed refactor

1. Create the kit package/module with the four primitives above + unit tests.
2. Replace each plugin's constructor defaulting and `with*` helper with `resolveOptions`.
3. Replace each `hasProperty`/inline column check with `EntityColumnProbe`.
4. Replace `getCurrentUserId`/`getTenant` swallow with `CurrentValueProvider` + explicit policy.
5. Have `orm/src/services/SoftDeleteInterceptor.ts` reuse `EntityColumnProbe` too.

## Suggested design patterns

- **Strategy** for `CurrentValueProvider` (sync value / async resolver / null object).
- **Null Object** for "no current user/tenant" so callers don't litter `undefined` checks.
- **Facade** (`EntityColumnProbe`) hiding `MetadataStorage` from plugins (dependency inversion).

## Testing plan

- Unit tests for each kit primitive (defaulting precedence, column probe property-vs-column match,
  null-object behaviour).
- Re-run each plugin's existing suite against the refactored internals (no behaviour change).
- Contract test: orm interceptor and plugin produce identical column-probe results.

## Acceptance criteria

- [ ] Defaulting logic exists in exactly one place.
- [ ] Column-probe logic exists in exactly one place, used by plugins and orm interceptor.
- [ ] No plugin imports `@ts-linq/metadata` directly for column checks.
- [ ] `with*` duplicate-default helpers removed or delegate to the kit.
- [ ] All existing plugin tests pass unchanged in behaviour.

## Refactor order

1. Kit + tests. 2. Audit adopts kit. 3. Soft-delete adopts kit. 4. Multi-tenant adopts kit.
5. orm interceptor adopts probe.

## Notes

Gate on `_shared/task-1`: if plugins are retired, only the orm interceptor's column-probe extraction
survives and this task shrinks to S.
