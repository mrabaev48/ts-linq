---
status: completed
phase: phase-x
package: query
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: ["query/task-1.md", "query/task-8.md"]
---

# Refactor: Extract the filtered-include `Proxy` and fix its double-invocation smell

## Problem
The filtered-include detection logic is implemented as an **inline anonymous `Proxy`** built
directly inside `Queryable.include` (`Queryable.ts:1041-1066`). On the happy path the user
lambda is invoked once against the proxy; on a thrown error the code **re-invokes the same
lambda a second time** to surface the error:

```ts
try {
  proxyResult = (keyOrSelector)(makeIncludeProxy());
} catch {
  // Proxy call threw (e.g. forbidden operator) — re-run to surface the error
  (keyOrSelector)(makeIncludeProxy());   // <-- second invocation
  return this; // unreachable but satisfies TS
}
```

## Evidence
- Inline proxy + double invocation: `Queryable.ts:1041-1053`.
- The `return this; // unreachable` comment (`:1052`) signals the control flow is awkward
  enough to confuse the type-checker.

## Why this is bad
- **Double side effects**: if the include lambda has any observable side effect (it
  shouldn't, but it *can*), it runs twice on the error path.
- **Lost stack/identity**: re-running may not reproduce the same error (non-deterministic
  lambdas), and discards the original error object.
- **God-class coupling**: the proxy construction sits in the 1800-line `Queryable`, adding to
  its surface (see `query/task-1.md`).
- **Dead control flow** (`return this; // unreachable`) is a code smell.

## Target architecture
Extract an `IncludeSelectorResolver` (Clean Code: one small, named, testable unit) that:
- builds the include proxy,
- invokes the selector **once**,
- returns a discriminated result `{ kind: 'subquery'; value } | { kind: 'error'; error }`,
so `Queryable.include` just switches on the result and rethrows the captured error directly
(no re-invocation, no unreachable branch).

## Proposed refactor
1. Create `IncludeSelectorResolver.resolve(selector): IncludeResolution` capturing any thrown
   error instead of relying on a second run.
2. `Queryable.include` (or the future `IncludeBuilder`) consumes the resolution.
3. Rethrow `resolution.error` directly when present.

## Suggested design patterns
- **Result/Either type** for the resolution — *Why*: makes the success/failure branches
  explicit and removes the unreachable `return`.
- **Extract Class / Extract Method** — *Why*: shrinks the god class and makes proxy behavior
  unit-testable.

## Testing plan
- **Unit**: selector returning a filtered subquery → `{ kind: 'subquery' }`; selector
  throwing → `{ kind: 'error' }` with the *original* error; lambda invoked exactly once
  (spy assertion).
- **Regression**: existing `filteredInclude.test.ts` green.

## Acceptance criteria
- [ ] Filtered-include proxy extracted to `IncludeSelectorResolver`.
- [ ] User selector invoked at most once on any path.
- [ ] Original error rethrown (not a re-run result).
- [ ] No `// unreachable` branch remains.
- [ ] `filteredInclude.test.ts` green.

## Refactor order
Fold into `IncludeBuilder` extraction in `query/task-1.md`; align error handling with
`query/task-8.md`.

## Notes
Small, low-risk, high-clarity win; good first PR while the larger decomposition is planned.
