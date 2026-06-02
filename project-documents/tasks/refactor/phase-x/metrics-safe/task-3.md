---
status: not-started
phase: phase-x
package: metrics-safe
priority: P3
effort: M
risk: low
category: package-boundary
depends_on: []
related: ["prometheus-sql-logger/README.md"]
---

# Refactor: Assess MemoryProfiler boundary / module separation

## Problem

`@ts-linq/metrics-safe` bundles two unrelated responsibilities: (1) the
safe-invoke helpers for optional logging, and (2) `MemoryProfiler`, a substantial
process/heap memory sampler with heap-snapshot capability. They share a package
only by the loose theme "metrics", which weakens the package's cohesion.

## Evidence

- `packages/metrics-safe/src/lib/MetricsSafe.ts` — ~68 LOC of safe-invoke
  helpers, zero Node API usage beyond `process.env`.
- `packages/metrics-safe/src/lib/MemoryProfiler.ts` — ~228 LOC, depends on
  `node:fs`, `node:path`, `node:inspector`, `process.memoryUsage`,
  `FinalizationRegistry`, `setInterval`. A different domain (runtime memory
  observability) with different dependencies.
- The only cross-link is thematic; they do not call each other.
- `MemoryProfiler` is consumed by `prometheus-sql-logger`
  (`PrometheusSqlLogger.ts:22-35`, `initMemoryMetrics`) via a structural
  `MemoryProfilerLike` type — i.e. the consumer already depends on the *shape*,
  not the class, so a boundary move is low-risk.

## Why this is bad

- **Low cohesion (SRP at package level).** A package named for "safe metrics
  helpers" also ships a Node-coupled memory profiler. Consumers wanting only the
  safe helpers pull in `node:inspector`/`fs` typings and a heavier module.
- **Discoverability.** A memory profiler is not where a reader looks under
  "metrics-safe".

## Target architecture

This is an **investigation** task: decide whether `MemoryProfiler` should be its
own module or package boundary, guided by **SRP** and **package cohesion**.
Options:

- **(A) Keep, but separate entrypoints.** Expose `MemoryProfiler` via a subpath
  export (`@ts-linq/metrics-safe/memory`) so the safe helpers stay light. Low
  effort, preserves the dep graph.
- **(B) Extract to its own package** (`@ts-linq/memory-profiler`). Cleaner
  cohesion; `prometheus-sql-logger` already depends on a structural type, so the
  break is minimal. Higher effort (new package, changeset, build wiring).
- Recommendation: **(A)** unless a broader observability package reorg is planned;
  revisit if more memory tooling is added.

## Proposed refactor

1. Confirm all `MemoryProfiler` consumers (grep `MemoryProfiler`/
   `MemoryProfilerLike` across packages).
2. Evaluate (A) vs (B) against the repo's package conventions and `arch:deps`.
3. Document the decision; if (A), add the subpath export and keep the root export
   for back-compat.

## Suggested design patterns

- **SRP at package granularity:** one package, one reason to change.
- **Interface segregation:** `prometheus-sql-logger` already depends on
  `MemoryProfilerLike` (structural), reinforcing a clean seam.

## Testing plan

- If (A): assert both `@ts-linq/metrics-safe` and the subpath resolve the
  expected symbols; existing `MemoryProfiler.test.ts` unchanged.
- If (B): move tests with the package; add a contract test that
  `prometheus-sql-logger` still accepts the moved profiler via `MemoryProfilerLike`.

## Acceptance criteria

- [ ] A documented decision (A or B) with rationale.
- [ ] If implemented: consumers unaffected (`prometheus-sql-logger` builds);
      back-compat export retained or a changeset/migration noted.
- [ ] `arch:deps`/`arch:cycles` clean.

## Refactor order

1. Inventory consumers.
2. Decide.
3. Implement chosen option behind back-compat.

## Notes

P3 — cohesion polish, not a defect. Listed because the package name and contents
diverge; safe to defer until a broader observability reorg.
