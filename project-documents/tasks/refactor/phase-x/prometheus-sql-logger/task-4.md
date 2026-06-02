---
status: not-started
phase: phase-x
package: prometheus-sql-logger
priority: P2
effort: M
risk: low
category: error-handling
depends_on: []
related: ["open-telemetry-sql-logger/task-4.md", "metrics-safe/task-2.md", "composite-sql-logger/task-3.md"]
---

# Refactor: Shared safe-call helper + explicit missing-prom-client state

## Problem
Two related error-handling smells: (1) ~21 copy-pasted `try { … } catch {}`
blocks wrap individual metric writes with no shared helper and no diagnostic;
(2) when `prom-client` cannot be loaded the entire logger silently becomes a
no-op with no signal to the operator.

## Evidence
- Empty catches around metric writes (representative):
  `packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger.ts:385-404`,
  `:419-421`, `:446-455`, `:463-468`, `:473-478`, `:482-491`, `:516-536`,
  `:552-567`, `:571-575`, `:579-583`, `:587-591`, `:595-602`, `:652-658`.
  (Repo grep: 21 empty/silent catch blocks in this package.)
- Silent client load failure: `safeRequirePromClient`
  (`.../PrometheusSqlLogger.ts:605-611`) catches and returns `undefined`;
  constructor then `return`s early (`.../PrometheusSqlLogger.ts:104`) leaving
  `enabled=false` with no warning.

## Why this is bad
- 21 duplicated catch blocks = noise and inconsistency (some catches log via
  `console.warn` elsewhere in the cluster, these are fully silent).
- Silent disable: a user who wired the Prometheus logger gets zero metrics with
  no explanation — same misconfiguration trap as the OTel logger.
- A logger swallowing every error is correct in principle (must not break the
  pipeline) but it should be *one* policy, optionally observable, not 21 hidden
  ones.

## Target architecture
- A single safe-invoke wrapper (one place that catches, never throws, and
  optionally emits a debug-gated diagnostic) used by every metric write —
  matching the convention already established by `@ts-linq/metrics-safe`
  (`tryInvoke` / `warnIfLoggerDebug`,
  `packages/metrics-safe/src/lib/MetricsSafe.ts:11,58`).
- The disabled state (missing client) is explicit and observable.

## Proposed refactor
1. Introduce a private `safe(fn)` helper (or reuse a generalized
   `metrics-safe` safe-invoke per metrics-safe/task-2) and replace the 21 inline
   catches with calls to it.
2. On `prom-client` load failure, emit one debug-gated diagnostic via the
   `metrics-safe` convention and expose `isEnabled()`.
3. Document that the logger degrades to a safe no-op when `prom-client` is
   absent or a metric primitive throws.

## Suggested design patterns
- **Decorator / higher-order function**: the `safe()` wrapper centralizes the
  fail-safe + diagnostic policy.
- **Null Object**: explicit disabled state instead of scattered `enabled`/`?.`.

## Testing plan
- Unit: a metric primitive that throws does not propagate and (with debug
  enabled) emits exactly one diagnostic.
- Unit: missing `prom-client` → `isEnabled() === false`, handlers are no-ops.
- Verify no behavioural regression in existing tests.

## Acceptance criteria
- [ ] All metric writes route through one safe-invoke helper.
- [ ] No bare empty `catch {}` remains around metric writes.
- [ ] Missing-client state is observable and diagnosed once.
- [ ] Tests cover throw-path and disabled-path.

## Refactor order
Best landed alongside or after task-3 (the split), reusing the helper across the
extracted collector. Can also coordinate with metrics-safe/task-2.

## Notes
Keep the fail-safe guarantee: a metrics exporter must never throw into the query
pipeline. The change is about *one* policy + observability, not about removing
the safety.
