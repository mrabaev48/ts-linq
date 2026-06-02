---
status: not-started
phase: phase-x
package: prometheus-sql-logger
priority: P0
effort: M
risk: high
category: performance
depends_on: []
related: ["prometheus-sql-logger/task-3.md"]
---

# Refactor: Bound label cardinality / stop labeling metrics on SQL-parsed entity

## Problem
`PrometheusSqlLogger` attaches an `entity` (and `operation`, `error_type`) label
to counters and histograms, where `entity` is extracted from arbitrary SQL text
via regex. Prometheus creates a distinct time series per unique label
combination, so deriving a label from unconstrained runtime SQL can produce
unbounded cardinality — exhausting scraper memory and degrading or crashing the
monitoring backend.

## Evidence
- `parseEntity` regex-extracts the table name from SQL:
  `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:628-637`.
- `parseOperation` derives `operation` from SQL:
  `.../PrometheusSqlLogger.ts:624-627`.
- High-cardinality labels attached to a histogram + counters in `queryEnd`:
  `.../PrometheusSqlLogger.ts:384-403`
  (`labels = { provider, operation, entity, success }` on `db_query_total` and
  `db_query_duration_ms`; `error_type: info.error.name` on `db_error_total`).
- Same `entity` label on analysis metrics:
  `.../PrometheusSqlLogger.ts:650-657`; on retry:
  `.../PrometheusSqlLogger.ts:415-420`.
- `error_type` from `info.error.name` (arbitrary error class names):
  `.../PrometheusSqlLogger.ts:396-401`.

## Why this is bad
- Operational hazard: a single deployment running many distinct entities / raw
  queries / subselects multiplies series across `provider × operation × entity ×
  success` *per metric* — a textbook Prometheus cardinality explosion.
- The `entity` value is also unreliable (regex over CTEs, joins, quoted/bracketed
  identifiers) → noisy, misleading dashboards.
- A metrics exporter should never let untrusted runtime strings become label
  values without bounds.

## Target architecture
- Label values are drawn from a *bounded, configurable allow-list* (or are
  hashed/bucketed/“other”-collapsed when unknown), not from free-form SQL.
- The structured operation/entity should come from the event payload metadata
  produced by the ORM, not be re-parsed from SQL here (see task-3 for moving the
  extractor out, and the ORM event contract).
- Cardinality limits are an explicit, documented configuration concern.

## Proposed refactor
1. Add an option to disable the `entity` label entirely (default-safe) and/or
   supply an allow-list of known entity names; unknown values collapse to
   `"other"`.
2. Constrain `operation` to the fixed SQL verb set (already effectively bounded;
   keep `OTHER` bucket) and document it as bounded.
3. Constrain `error_type` to a bounded set or collapse unknown error class names.
4. Prefer structured `operation`/`entity` from the event payload over SQL parsing
   when available.

## Suggested design patterns
- **Strategy** for label derivation (allow-list / bucketed / disabled) injected
  via options — Open/Closed, testable.
- **Bounded value object** for label sets (validate against allow-list at the
  boundary).

## Testing plan
- Cardinality test: feed N adversarial distinct SQL strings; assert the set of
  distinct `entity` label values produced stays ≤ allow-list size + 1 (`other`).
- Unit: unknown entity collapses to `other`; known entity passes through.
- Unit: `entity` label can be disabled entirely.
- Regression: existing `PrometheusSqlLogger.test.ts` /
  `PrometheusAnalysis.test.ts` still pass.

## Acceptance criteria
- [ ] `entity` label is bounded (allow-list / bucketed) or disabled by default.
- [ ] `error_type` is bounded.
- [ ] Adversarial-SQL cardinality test passes.
- [ ] Behaviour and cardinality implications documented in option JSDoc.

## Refactor order
Do first — this is the availability-risk fix and is independent of the structural
split.

## Notes
Rated P0/high-risk because the failure mode is the monitoring system itself, not
the ORM. Coordinate with the ORM event contract owner to expose structured
operation/entity so SQL parsing can eventually be removed (task-3).
