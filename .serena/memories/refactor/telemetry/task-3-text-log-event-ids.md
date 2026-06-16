# refactor/telemetry/task-3 — routable text-log event ids

✅ DONE — telemetry's 3RD/FINAL task (P2/S/low-risk, clean-code).

## What changed
- `DiagnosticEmitter` text-log methods (`debug`/`info`/`warn`/`error`) previously routed
  through a magic empty-string event id `route('', level, msg)` → `routes.get('')` always
  missed → `WarningConfigurationBuilder` (`suppress`/`throw`/`log`) could never apply to
  text logs (behaviour collapsed to pure level filtering).
- Added 4 ids to `CoreEventId` in `packages/telemetry/src/event-ids.ts`:
  `logDebug:'core.log-debug'`, `logInfo:'core.log-info'`, `logWarn:'core.log-warn'`,
  `logError:'core.log-error'` (separate id per level, matching catalogue granularity).
- Repointed the four `route('', ...)` calls (diagnostic-emitter.ts) to these real ids;
  **level argument unchanged** so level filtering is identical. No `route('', ...)` remains.
- Doc comment on the "Logger text methods" section says text logs are now routable like
  structured events.

## Behaviour
- Text logs now honour `suppress`/`throw`/`log` exactly like structured events.
- Default (unconfigured) output behaviour is UNCHANGED (existing log-level-filtering tests
  stay green; added regression test asserting debug dropped below `information`, rest pass).
- New describe block "text-log routing" in tests-new/diagnostic-emitter.test.ts (6 tests):
  suppress('core.log-warn') silences warn() + doesn't affect info/error; level filtering
  still applies to non-suppressed; throw('core.log-error') → EfWarningError; log('core.log-debug')
  forces output above threshold; default unchanged.

## Versioning
- `@ts-linq/telemetry` minor → **2.3.0** (new public exported event ids = backward-compatible
  API surface; default behaviour unchanged). orm patch (dependent bump). Consistent with task-1.

## Status
- Pairs with task-1 (both extend event-ids.ts catalogue + routing coverage).
- **telemetry package FULLY COMPLETE (1–3); next package = orm (step 12).**

## Validation
typecheck ✅ · lint ✅ (0 errors; pre-existing `_meta`/`_message` warnings elsewhere) ·
test:unit ✅ 3629 · test:integration ✅ 461 (2 pre-existing skips) · test:e2e ✅ 290 ·
build ✅ · arch:deps ✅ · arch:cycles ✅ · arch:dead ✅ (no new).
