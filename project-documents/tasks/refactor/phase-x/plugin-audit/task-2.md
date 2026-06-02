---
status: not-started
phase: phase-x
package: plugin-audit
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: []
related: ["plugin-multi-tenant/task-5.md"]
---

# Refactor: Stop silently swallowing user-resolution errors

## Problem

`getCurrentUserId()` wraps the user resolver in a bare `try/catch` and returns `undefined` on any
failure, silently dropping the `createdBy`/`updatedBy` audit stamp without any signal.

## Evidence

`packages/plugin-audit/src/AuditMiddleware.ts:104-114`:

```ts
private async getCurrentUserId(): Promise<string | number | undefined> {
  if (!this.options.getCurrentUser) return undefined;
  try {
    return await Promise.resolve(this.options.getCurrentUser());
  } catch {
    return undefined;   // bare catch, no logging, no rethrow
  }
}
```

Downstream, `undefined` means the `createdBy`/`updatedBy` columns are simply not written
(`AuditMiddleware.ts:63-65,84-85` guard on `currentUser !== undefined`).

## Why this is bad

- **Invalid silent swallow (classified):** a failing user resolver produces audit rows with no author
  and no diagnostic — the audit trail is silently incomplete, defeating the plugin's purpose.
- Loses the root cause of the resolver failure.
- Conflates "no resolver configured" (legitimately `undefined`) with "resolver threw" (an error).

## Target architecture

Explicit error policy with a typed error and diagnostics via the project's logging sink. Distinguish
"no resolver" (Null Object → undefined) from "resolver failed" (propagate or log-and-policy). Follow
the **error-handling-patterns** skill: no Pokemon-catch; typed errors.

## Proposed refactor

1. Remove the bare catch; let resolver errors propagate, OR wrap as `AuditUserResolutionError` and
   apply a configurable policy (`'throw' | 'skip'`, default `'throw'`).
2. Log via the shared diagnostic sink when skipping.
3. Keep the "no resolver configured" path as an explicit Null Object returning undefined.

## Suggested design patterns

- **Typed error hierarchy** (`AuditUserResolutionError`), **Policy object** (throw vs skip),
  **Null Object** for "no resolver".

## Testing plan

- Resolver throws + policy `throw` → error surfaces.
- Resolver throws + policy `skip` → logged, audit proceeds without author (explicitly tested).
- No resolver configured → undefined, no error.

## Acceptance criteria

- [ ] No bare `catch { return undefined }` in the package.
- [ ] Resolver failure is distinguishable from "no resolver".
- [ ] Failure default is fail-loud or explicitly-policied, not silent.
- [ ] Diagnostics emitted when skipping.

## Refactor order

1. Typed error + policy. 2. Remove swallow. 3. Tests.

## Notes

Mirrors `plugin-multi-tenant/task-5`; consider a shared resolver-error policy in the plugin-kit (`_shared/task-2`).
