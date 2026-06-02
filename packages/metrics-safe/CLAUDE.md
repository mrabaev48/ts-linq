# CLAUDE.md — @ts-linq/metrics-safe

## Role

Provides **fail-safe** wrappers so the ORM can emit metrics / profile memory without a hard
dependency on a metrics backend. The defining property: if nothing is wired up, calls are no-ops.

## Hard boundaries

- **Zero dependencies** — keep it that way. The whole point is that depending on this package adds
  no transitive metrics dependency.
- Consumed by `core`, `query`, `cache`. Must not depend on any of them.

## Critical invariants

- Every public helper must be safe to call when no collector is registered (Null-Object behavior).
- No throwing on the metrics path — a telemetry failure must never break a query.

## Public API surface & stability

- Public via `src/index.ts` (`MetricsSafe`, `MemoryProfiler`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/metrics-safe/` — make the Null-Object behavior
explicit and ensure failures in a real backend are isolated.

## Validation

```bash
pnpm --filter @ts-linq/metrics-safe typecheck
pnpm --filter @ts-linq/metrics-safe lint
pnpm --filter @ts-linq/metrics-safe build
```

## Do / Don't

- **Do** keep every entry point no-op-safe and non-throwing.
- **Don't** add dependencies or import higher-level packages.
