# CLAUDE.md — @ts-linq/open-telemetry-sql-logger

## Role

Optional **`SqlLogger`** that emits OpenTelemetry spans for SQL execution.

## Hard boundaries

- Depends on `@ts-linq/types`; `@ts-linq/core` is a peer.
- Must implement the `SqlLogger` contract exactly; no other ORM internals.

## Critical invariants & known hazards

- **Never throw into the query path** — a tracing failure must be swallowed *safely* (logged, not
  propagated), distinct from the silent-catch antipattern elsewhere.
- Run SQL/parameters through masking before attaching to spans — don't leak secrets into traces.
- Span-mapping logic overlaps with `@ts-linq/telemetry`; share it rather than fork (refactor task).

## Public API surface & stability

- Public via `src/index.ts` (`OpenTelemetrySqlLogger`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/open-telemetry-sql-logger/` — de-dupe span mapping;
stop discarding event classes silently.

## Validation

```bash
pnpm --filter @ts-linq/open-telemetry-sql-logger typecheck
pnpm --filter @ts-linq/open-telemetry-sql-logger lint
pnpm --filter @ts-linq/open-telemetry-sql-logger build
```

## Do / Don't

- **Do** mask sensitive values; isolate tracing failures.
- **Don't** propagate span errors into queries; don't duplicate telemetry mapping.
