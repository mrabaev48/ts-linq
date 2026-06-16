# refactor/telemetry/task-1: Make DiagnosticEmitter resilience/cache events routable

## Status: ✅ DONE (PR pending)

## Problem fixed
`DiagnosticEmitter` had 8 hard-coded no-op event methods with no opt-in path.
Resilience events (circuit-open, fallback, connection-health) were silently discarded.

## Changes

### packages/telemetry/src/event-ids.ts
Added to `CoreEventId`:
- `cache` → `'core.cache'`
- `cacheSize` → `'core.cache-size'`
- `connectionHealth` → `'core.connection-health'`
- `circuit` → `'core.circuit-open'`
- `fallback` → `'core.fallback'`
- `hedgedWin` → `'core.hedged-win'`
- `analysis` → `'core.analysis'`

Added to `RelationalEventId`:
- `crossQuery` → `'relational.cross-query-chunk'`

### packages/telemetry/src/diagnostic-emitter.ts
All 8 no-op methods now call `route(eventId, level, message)`.

## Default level policy
| Event | Level | Behavior at default `information` |
|---|---|---|
| `circuit` | `warning` | **Surfaces** |
| `fallback` (failed) | `error` | **Surfaces** |
| `fallback` (succeeded) | `warning` | **Surfaces** |
| `connectionHealth` (unhealthy) | `warning` | **Surfaces** |
| `connectionHealth` (healthy) | `debug` | Suppressed |
| `cache` | `trace` | Suppressed |
| `cacheSize` | `trace` | Suppressed |
| `crossQuery` | `debug` | Suppressed |
| `hedgedWin` | `debug` | Suppressed |
| `analysis` | `debug` | Suppressed |

## Per-event control
`WarningConfigurationBuilder.suppress('core.circuit-open')` / `.throw(...)` works for all 8 new ids.

## Version bump
`@ts-linq/telemetry` minor: `2.1.20` → `2.2.0`

## Validations
- typecheck ✅, lint ✅, tests:unit (3603 tests) ✅, build ✅, arch:deps ✅, arch:cycles ✅, arch:dead ✅

## Next telemetry tasks
- task-2: Extract shared SQL-masking utility (P1)
- task-3: Fix empty-string event id in text log methods (P2)
