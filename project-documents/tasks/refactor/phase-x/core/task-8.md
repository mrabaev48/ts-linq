---
status: not-started
phase: phase-x
package: core
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: ['core/task-5.md']
---

# Refactor: Fix direct `console` coupling and ad-hoc logging fallbacks in core

## Problem
Core has two logging concerns that should go through the abstraction layer:
(1) `LazyLoadingProxy` falls back to `console.warn` when no logger is set, hard-coupling a
library to stdout/stderr; (2) `InternalLogger.logInternalError` writes directly to
`console.error`. A library writing to the console by default is a known anti-pattern —
consumers cannot redirect or silence it.

## Evidence
- `packages/core/src/loading/LazyLoadingProxy.ts:24-29` `getLogger()` returns a default `{ warn: (m, e) => console.warn(m, e) }`.
- `packages/core/src/utils/InternalLogger.ts:9,11` — `console.error(prefix, ...)` unconditionally.
- `LazyLoadingProxy` also uses a static `_logger` field (line 18) — static mutable global logging state, conflicting with the per-context injection direction of `core/task-2`.

## Why this is bad
- **Library hygiene**: default console output cannot be controlled by the host app; pollutes logs/tests.
- **Inconsistency**: there is a `SqlLogger`/diagnostic abstraction in `@ts-linq/types`, bypassed here.
- **Hidden global state**: `LazyLoadingProxy._logger` static mirrors the singleton problems flagged in `core/task-2`.

## Target architecture
Route all internal logging through an injected diagnostic sink / `SqlLogger`. Provide a
Null Object logger as the default (no console output) and let the composition root attach a
console-or-other logger explicitly. Remove the static `_logger` in favour of constructor
injection (consistent with `MetadataSource` injection).

## Proposed refactor
1. Replace the `console.warn` default in `LazyLoadingProxy.getLogger()` with a Null Object logger (no-op) or a passed-in sink.
2. Make `logInternalError` accept an optional sink; default to no-op (or a single configurable global hook), not `console.error`.
3. Remove `LazyLoadingProxy._logger` static; pass the logger via `create`/`createMany` parameters (already partly threaded as `(msg, err) => ...` at `LazyLoadingProxy.ts:71`).
4. Document that hosts opt into console logging explicitly.

## Suggested design patterns
- **Null Object** — silent default logger.
- **Dependency Injection** — logger passed in, not statically held.
- **Strategy** — pluggable sinks (console, diagnostic emitter, test spy).

## Testing plan
- Unit: by default no `console.*` is invoked (spy asserts zero calls).
- Unit: an injected sink receives the warn/error events.
- Regression: lazy-loading warnings still reach an attached logger.

## Acceptance criteria
- [ ] No unconditional `console.*` in `packages/core/src` non-test code.
- [ ] `LazyLoadingProxy` static `_logger` removed.
- [ ] Default behaviour is silent unless a sink is attached.
- [ ] Cluster validations pass.

## Refactor order
Small; do alongside `core/task-2`/`core/task-5` so the injected-logger and injected-metadata work share a composition-root pass.

## Notes
Coordinate the `logInternalError` signature with the unified telemetry channel referenced in `core/task-5`.
