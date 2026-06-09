---
status: completed
phase: phase-x
package: concurrency
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["task-2.md"]
---

# Refactor: De-duplicate RetryPolicies across `concurrency` and `core`

## Problem

The three retry-policy classes exist twice in the monorepo, byte-for-byte
identical, in two different packages. Consumers may import either copy; an
`instanceof ExponentialBackoffRetryPolicy` against the "wrong" copy returns
`false`, and a behavioral fix to one copy silently misses the other.

## Evidence

Identical definitions (same class names, same bodies, same `ExponentialBackoff
Options` interface, same doc comments):

- `packages/concurrency/src/RetryPolicies.ts:13` `ExponentialBackoffRetryPolicy`,
  `:38` `NoRetryPolicy`, `:48` `FixedIntervalRetryPolicy`.
- `packages/core/src/utils/RetryPolicies.ts:13` `ExponentialBackoffRetryPolicy`,
  `:38` `NoRetryPolicy`, `:48` `FixedIntervalRetryPolicy`.

Both are publicly exported:

- `packages/concurrency/src/index.ts` → `export * from './RetryPolicies'`.
- `packages/core/src/index.ts:79` → `export * from './utils/RetryPolicies'`
  (also re-exported via `core/src/utils/index.ts:4`).

Both implement `RetryPolicy` from `@ts-linq/types`. `core`'s
`ResilienceManager` (`core/src/Resilience/ResilienceManager.ts:108,120`) consumes
`RetryPolicy.shouldRetry`/`getDelayMs`.

## Why this is bad

- **Two sources of truth** for a public API; divergence is a matter of time.
- **Cross-package `instanceof` breakage** — a policy created from `core` is not an
  instance of the `concurrency` class and vice versa.
- **Duplicated maintenance** — a jitter or cap fix must be applied twice.
- Violates DRY and the package-boundary rule "Do not duplicate shared logic
  across packages; shared abstractions belong in shared/core packages."

## Target architecture

Single canonical home with re-export for backward compatibility (dependency
inversion + published-language boundary):

- The `RetryPolicy` *interface* already lives in `@ts-linq/types` (correct).
- Pick **one** implementation home. Given that `concurrency` is the
  resilience-focused package and `core` is a heavyweight foundation,
  `@ts-linq/concurrency` is the better canonical home for the *policy classes*.
- `@ts-linq/core` re-exports the classes from `@ts-linq/concurrency` (or, if a
  core→concurrency dependency is undesirable per the layering, do the reverse and
  make `concurrency` re-export from `core`). Decide based on the existing
  dependency direction (`orm → concurrency` and `orm → core`; check whether
  `core → concurrency` would introduce a cycle via `pnpm arch:cycles`).
- Delete the duplicate file; replace with `export * from '<canonical>'` so all
  existing import paths keep working.

## Proposed refactor

1. Run `pnpm arch:cycles`/`arch:deps` to determine which direction avoids a
   cycle (`core` currently has no dep on `concurrency`).
2. Keep the implementation in the chosen package; convert the other package's
   `RetryPolicies.ts` to a pure re-export (no class bodies).
3. Verify `ResilienceManager` and any provider code still resolve the classes.
4. Add a changeset (public API consolidation; `patch` if re-exports preserve all
   identifiers, otherwise `minor`/`major`).

## Suggested design patterns

- **Single source of truth / re-export facade** — one definition, many entry
  points, identical identity.
- **Dependency inversion via shared interface** — `RetryPolicy` in `types` stays
  the contract; implementations live in exactly one package.

## Testing plan

- **Identity test:** a policy constructed via the `core` import path
  `instanceof` the `concurrency` class (passes only after consolidation).
- **Regression:** `concurrency/tests-new/RetryPolicies.test.ts` plus any core
  resilience tests pass against the single implementation.
- **Arch:** `pnpm arch:cycles` shows no new cycle introduced by the re-export.

## Acceptance criteria

- [ ] Exactly one definition of each retry-policy class in the monorepo.
- [ ] The non-canonical package re-exports the classes (all import paths intact).
- [ ] Cross-package `instanceof` holds.
- [ ] `pnpm build && pnpm arch:cycles && pnpm arch:deps` pass.
- [ ] Changeset added.

## Refactor order

1. Determine canonical home via dependency direction.
2. Collapse the duplicate to a re-export.
3. Add identity + regression tests.

## Notes

If layering rules forbid a `core → concurrency` edge and a re-export the other
way would be awkward, an alternative is to move the policy *classes* down into
`@ts-linq/types` alongside the `RetryPolicy` interface — but only if `types` is
allowed to contain runtime classes (it currently exports runtime values like
`ok`/`err`, so this is plausible). Decide during step 1.
