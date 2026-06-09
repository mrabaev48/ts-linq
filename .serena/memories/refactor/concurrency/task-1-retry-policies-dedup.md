# refactor/concurrency/task-1 — De-duplicate RetryPolicies (concurrency ↔ core)

**Status:** ✅ Completed. Package `concurrency` stays 🔄 In Progress (task-2 pending).

## Problem
`ExponentialBackoffRetryPolicy`, `NoRetryPolicy`, `FixedIntervalRetryPolicy` +
`ExponentialBackoffOptions` were byte-for-byte duplicated in:
- `packages/concurrency/src/RetryPolicies.ts`
- `packages/core/src/utils/RetryPolicies.ts`
Two sources of truth → cross-package `instanceof` returned `false`.

## Canonical-home decision: `@ts-linq/concurrency`
Evidence (matrix "core→concurrency no cycle ⇒ canon = concurrency"):
- `concurrency` depends only on `@ts-linq/types`; `core` had no dep on it ⇒
  `core → concurrency → types` is acyclic. `arch:cycles` (madge) confirmed: no cycle.
- `.dependency-cruiser.cjs` forbidden rules (`no-deprecated-core-to-runtime`,
  `no-core-to-dialects`) only block core→runtime/dialects; `concurrency` not in
  the `to` lists ⇒ edge allowed. `arch:deps` confirmed: 0 violations.
- `packages/concurrency/CLAUDE.md` explicitly declares concurrency the single
  source of truth and marks core's copy "stale duplicate".

## Implementation
- `core/src/utils/RetryPolicies.ts` → pure **named** re-export from
  `@ts-linq/concurrency` (NOT `export *`, to avoid leaking `ExecutionStrategy`
  into core's public surface). All import paths preserved
  (`@ts-linq/core`, `./utils/RetryPolicies`, `../src/utils/RetryPolicies`).
- `core/package.json` deps += `@ts-linq/concurrency: workspace:*`.
- `core/tsconfig.json` references += `{ "path": "../concurrency" }` (composite).
- `core/tsconfig.esm.json`: NO change needed — concurrency exposes top-level
  `types: ./dist/index.d.ts`, so node10 resolution finds it (unlike metrics-safe,
  which needed an explicit `/dist` path mapping for its `/memory` subpath).
- Jest already maps `@ts-linq/concurrency → packages/concurrency/src`
  (`packages/jest-config/index.js`).

## Identity guarantee
One class object monorepo-wide ⇒ cross-package `instanceof` holds both ways.
New guard: `packages/core/tests-new/RetryPolicies.identity.test.ts`
(`CoreClass === ConcClass` + `instanceof` both directions).

## Consumers
No production file outside the two `RetryPolicies.ts` imports the concrete
classes. `core/src/Resilience/ResilienceManager.ts` uses the `RetryPolicy`
*interface* only ⇒ unaffected. Remaining importers are the test files.

## Validation (all green)
typecheck ✓ · lint ✓ (0 errors) · test:unit ✓ 3068 · test:integration ✓ 464 ·
test:e2e ✓ 290 · build ✓ · arch:deps ✓ (0 viol) · arch:cycles ✓ (no cycle) ·
arch:dead ✓.

## Changeset
`@ts-linq/core: patch` (.changeset/concurrency-dedup-retry-policies.md);
dependents propagate automatically. `concurrency` API unchanged ⇒ no changeset.

## Coordination note for concurrency/task-2
task-2 wires `ExecutionStrategy` to a `RetryPolicy`. The canonical policy
implementations now live in `concurrency/src/RetryPolicies.ts` — task-2 should
consume them in-package directly, not via core's re-export.
