---
status: completed
phase: phase-x
package: telemetry
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Fix DiagnosticEmitter text logging routing through empty-string event id

## Problem

`DiagnosticEmitter`'s four text-logging methods (`debug`, `info`, `warn`,
`error`) all route through the warning table using an empty-string event id
(`''`). Because no real event id is `''`, the per-event warning routes
(`suppress`/`throw`/`log`) can never apply to a plain text log, and `''` is a
magic value that hides intent.

## Evidence

`packages/telemetry/src/diagnostic-emitter.ts`:

- `debug` → `this.route('', 'debug', message);` (line 73).
- `info` → `this.route('', 'information', message);` (line 77).
- `warn` → `this.route('', 'warning', message);` (line 81).
- `error` → `this.route('', 'error', message);` (line 85).

`route()` (line 62) looks up `this.routes.get(eventId)`; with `eventId === ''`
the lookup is always a miss, so behaviour collapses to pure level filtering and
the configurability advertised by `WarningConfigurationBuilder` is unreachable
for text logs.

## Why this is bad

- **Magic value.** `''` as an event id is undocumented and easy to misread as
  "no event".
- **Dead configurability.** A user cannot `suppress`/`throw` a category of text
  log because there is no id to target. The route table is effectively inert for
  these four methods.
- **Inconsistency.** Structured events use meaningful ids (`core.query-start`
  etc.); text logs do not.

## Target architecture

Give text logs first-class, documented event ids and keep level filtering — a
small **Clean Code** fix:

- Define ids such as `core.log-debug`, `core.log-info`, `core.log-warn`,
  `core.log-error` (or a single `core.log` with the level carried separately) in
  `event-ids.ts`.
- Route each text method through its real id so `suppress`/`throw`/`log` can
  target them, matching the structured-event behaviour.

## Proposed refactor

1. Add the text-log event ids to `event-ids.ts`.
2. Replace the four `route('', ...)` calls with the real ids.
3. Document that text logs are routable like structured events.

## Suggested design patterns

- **Clean Code:** eliminate magic values; consistent identification.

## Testing plan

- Unit: `suppress('core.log-warn')` silences `warn()` output; level filtering
  still applies otherwise.
- Unit: `throw('core.log-error')` raises `EfWarningError` from `error()`.
- Regression: default behaviour (no routes) unchanged from today.

## Acceptance criteria

- [x] No `route('', ...)` calls remain.
- [x] Text logs carry real, catalogued event ids.
- [x] Text logs honour `suppress`/`throw`/`log` like structured events.
- [x] Default (unconfigured) output behaviour is unchanged.

## Refactor order

1. Add ids.
2. Repoint the four methods.
3. Tests + docs.

## Notes

Pairs naturally with telemetry/task-1 (both extend the event-id catalogue and
routing coverage).
