# Refactor Audit: prometheus-sql-logger

## Package responsibility

`@ts-linq/prometheus-sql-logger` (`packages/prometheus-sql-logger`,
`version 6.0.0`, `private`) provides a `SqlLogger` implementation
(`PrometheusSqlLogger`, `src/logger/PrometheusSqlLogger.ts`) that translates ORM
events into Prometheus metrics (counters, histograms, gauges) using a
`prom-client`-shaped client. It also optionally bridges a `MemoryProfiler` from
`@ts-linq/metrics-safe` into memory gauges.

## Current architectural problems

1. **God class (~663 LOC, ~45 fields).** A single class
   (`PrometheusSqlLogger.ts:51-663`) owns four unrelated responsibilities:
   (a) metric *registry construction* (the seven `initXxxMetrics` methods,
   lines 116-347); (b) `SqlLogger` *event handling* (lines 349-568); (c) SQL
   *parsing/labeling* (`parseOperation`/`parseEntity`/`cleanIdentifier`, lines
   624-662); and (d) lazy `prom-client` loading + masking (lines 605-623).
   This violates SRP and makes the class very hard to test in isolation.

2. **Label cardinality risk from SQL parsing.** `parseEntity`
   (`PrometheusSqlLogger.ts:628-637`) derives the `entity` label from arbitrary
   SQL via regex, and `queryEnd`/`analysis`/`retry` attach it to counters and
   histograms (e.g. `db_query_duration_ms{...,entity}`, lines 384-393). Any
   subquery, CTE, unusual identifier, or raw SQL produces a fresh label value →
   unbounded time-series cardinality, a classic Prometheus footgun (OOM in the
   scraper). `operation` (line 624) and `error_type` (line 400) are similarly
   derived from runtime data.

3. **Domain pollution.** SQL parsing (operation/entity extraction) is ORM
   query-domain logic embedded in a metrics exporter. The exporter should not
   know how to read SQL; the event payload should already carry structured
   operation/entity metadata.

4. **Pervasive empty `catch {}` (21 in the package).** Almost every metric write
   is wrapped in `try { … } catch {}` (e.g. lines 385-404, 419-421, 446-455,
   516-536, 552-567). This is defensible (a logger must not break the pipeline)
   but it is copy-pasted ~20 times with no shared safe-call helper and no
   debug-gated diagnostic — duplicated, and silent.

5. **Inline event-payload types instead of `@ts-linq/types`.** Every handler
   re-declares its `info` shape inline (e.g. `queryEnd` lines 369-377, `cache`
   lines 439-444, `circuit` lines 508-514) rather than using
   `QueryEndInfo`/`CacheInfo`/`CircuitEventInfo` from `@ts-linq/types`, so the
   contract can drift silently from the canonical `SqlLogger`.

6. **`cacheEvicted` is an off-contract method.** `PrometheusSqlLogger.cacheEvicted`
   (`PrometheusSqlLogger.ts:471`) is invoked by
   `@ts-linq/metrics-safe.safeCacheEvicted`
   (`packages/metrics-safe/src/lib/MetricsSafe.ts:51`) and by the base
   `EntityCache` (`packages/cache/src/EntityCache.ts:49`), yet `cacheEvicted` is
   NOT part of the `SqlLogger` interface (`packages/types/src/index.ts:192-206`).
   It is a duck-typed extension known only to these three files.

7. **Lazy `require('prom-client')` with silent fallback.** `safeRequirePromClient`
   (`PrometheusSqlLogger.ts:605-611`) disables the whole logger silently if the
   client is missing — same silent-misconfiguration issue as the OTel logger.

## Refactor goals

- Split the god class along its four responsibilities (Single Responsibility,
  composition-first): a metric registry, an event collector, a SQL label
  extractor (or remove it), and the lazy-client/masking concern.
- Bound label cardinality explicitly and stop deriving high-cardinality labels
  from raw SQL.
- Bind to `@ts-linq/types` event contracts.
- Replace the 21 duplicated empty catches with one shared safe-call helper that
  can optionally emit a debug-gated diagnostic.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Bound label cardinality / stop labeling on SQL-parsed entity | P0 | Operational hazard: unbounded Prometheus series can OOM the scraper |
| 2 | task-2.md — Bind handlers to `@ts-linq/types` event interfaces | P1 | Stops contract drift; precondition for the split |
| 3 | task-3.md — Split god class: registry / collector / label-extractor | P1 | SRP; testability; the headline structural fix |
| 4 | task-4.md — Make missing-prom-client state explicit + shared safe-call helper | P2 | De-duplicates 21 catches; surfaces silent misconfiguration |
| 5 | task-5.md — Formalize `cacheEvicted` in the SqlLogger contract | P2 | Removes duck-typed off-contract method |

## Dependencies on other packages

- Imports `SqlLogger`, `SqlParameter` from `@ts-linq/types`; should also import
  the `*Info` event types.
- Soft-depends on `prom-client` via lazy `require`.
- Consumes `MemoryProfiler` shape from `@ts-linq/metrics-safe` (structural).
- `cacheEvicted` couples it to `@ts-linq/metrics-safe` and `@ts-linq/cache`.

## Testing strategy

- Unit-test each split unit independently with a fake `PromClientLike`
  (registry creation, collector label mapping, label extractor).
- Cardinality test: feed adversarial SQL and assert the `entity`/`operation`
  label set stays within a bounded allow-list.
- Error-path test: a throwing metric primitive must not propagate.
- Disabled-client test: missing `prom-client` → no-op + observable state.

## Notes

This package is the largest single-file unit in the cluster and the clearest
"god class" finding. The cardinality task is rated P0 because it is an
availability risk to the monitoring system, not merely a code-quality issue.
