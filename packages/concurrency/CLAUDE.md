# CLAUDE.md — @ts-linq/concurrency

## Role

Resilience primitives: `ExecutionStrategy` + retry policies for transient DB failure handling.

## Hard boundaries

- Depends only on `@ts-linq/types`.
- Consumed by `orm` (and indirectly `core`). Must not depend on them.

## Critical invariants

- Retry policies must classify only **genuinely transient** errors as retryable; retrying a
  non-idempotent write blindly can double-apply effects.
- Backoff timing should be injectable for tests (avoid a hardcoded real clock / `setTimeout` that
  can't be faked).

## ⚠️ Duplication watch

- Retry-policy logic has historically been **byte-duplicated** into `@ts-linq/core`
  (`core/src/utils/RetryPolicies`). This package is intended to be the single source of truth.
  When changing policies, check `core` does not carry a stale copy (refactor task below).

## Public API surface & stability

- Public via `src/index.ts` (`ExecutionStrategy`, retry policies).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/concurrency/`:
- `task-1` — single source of truth for retry policies (de-dupe with `core`).
- injectable clock for deterministic backoff tests.

## Validation

```bash
pnpm --filter @ts-linq/concurrency typecheck
pnpm --filter @ts-linq/concurrency lint
pnpm --filter @ts-linq/concurrency build
```

## Do / Don't

- **Do** make the clock/timer injectable.
- **Don't** duplicate these policies in other packages — import them.
- **Don't** mark every error transient.
