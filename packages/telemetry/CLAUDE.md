# CLAUDE.md — @ts-linq/telemetry

## Role

Centralized **diagnostics/telemetry**: OTel integration, diagnostic events, parameter masking,
warning routing, tag→span mapping. Consumed by `orm`.

## Hard boundaries

- Depends only on `@ts-linq/types`.
- Must not depend on `core`/`query`/`orm`.

## Critical invariants & known hazards

- **Parameter masking must never leak secrets** — `parameter-masker.ts` redacts sensitive values;
  any new logging path must run values through it.
- **Telemetry failures must be isolated** — emitting a span/diagnostic must never throw into the
  query path.
- Span-mapping logic is **duplicated** with `open-telemetry-sql-logger`; consolidate rather than
  fork (refactor task below).

## Public API surface & stability

- Public via `src/index.ts` (`TelemetryProvider`, emitters, `parseTagsFromSql`, masker, router).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/telemetry/` — de-dupe span mapping with the OTel
logger; ensure no event class is silently discarded.

## Validation

```bash
pnpm --filter @ts-linq/telemetry typecheck
pnpm --filter @ts-linq/telemetry lint
pnpm --filter @ts-linq/telemetry build
```

## Do / Don't

- **Do** mask parameters on every logging path; isolate telemetry failures.
- **Don't** throw from emitters; don't duplicate span mapping across packages.
