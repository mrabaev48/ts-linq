# Refactor Audit: metrics-safe

## Package responsibility

`@ts-linq/metrics-safe` provides "safe" helpers for *optional* metrics/logging:
free functions (`safeCache`, `safeCacheSize`, `safeCacheEvicted`,
`warnIfLoggerDebug`) that invoke a possibly-absent, possibly-throwing logger
without ever propagating an error to the caller; plus a `MemoryProfiler` that
samples process/heap memory and can take heap snapshots.

## Current architectural problems

1. **Hard-coded method whitelist.** `tryInvoke` (`src/lib/MetricsSafe.ts:11`)
   only accepts the literal method names `'cache' | 'cacheSize' | 'cacheEvicted'`,
   and there is one bespoke `safeX` wrapper per method. Adding a new safely-invoked
   logger event (e.g. `safeFallback`, `safeCircuit`) requires editing both the
   union and adding a new wrapper — Open/Closed violation. The package's purpose
   (safe optional invocation) is general but the implementation is special-cased
   to three cache events.
2. **Misleading file name / no abstraction.** `MetricsSafe.ts` exports only free
   functions; there is no `MetricsSafe` type or namespace. The "safe invoke"
   concept is not surfaced as a reusable abstraction (e.g. a `SafeLogger`
   decorator/wrapper around a `SqlLogger`).
3. **Stale, wrong type-test file.** `test-d/index.test-d.ts` imports
   `EntityId`, `brandId`, `unbrandId`, `PrimaryKeyOf`, `DbSet`, `Queryable`,
   `TypedQueryable` from `'..'` — none of which `@ts-linq/metrics-safe` exports
   (the package exports only `MemoryProfiler` + the safe-metrics functions). This
   file is a copy from another package and tests nothing about metrics-safe; it
   would fail to compile against the real package surface.
4. **`MemoryProfiler` is loosely coupled but lives in a "metrics-safe" package.**
   It is a substantial, well-written component (~228 LOC) with a different
   responsibility (memory sampling/heap dumps) than the safe-invoke helpers. The
   two share a package only by the theme "metrics". Worth assessing whether
   `MemoryProfiler` belongs in its own module/package boundary.

## Refactor goals

- Generalize the safe-invoke helper into an extensible abstraction (no per-event
  hard-coding) while preserving the existing `safeX` convenience functions.
- Replace or correct the stale `test-d` so the package's actual type surface is
  tested.
- Clarify the boundary between the safe-invoke helpers and `MemoryProfiler`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Replace stale/wrong test-d file with real metrics-safe type tests ✅ **completed** | P1 | The file tests a different package; it is dead/invalid |
| 2 | task-2.md — Generalize tryInvoke into an extensible safe-invoke abstraction (OCP) ✅ **completed** | P2 | Hard-coded 3-method whitelist blocks new safe events |
| 3 | task-3.md — Assess MemoryProfiler boundary / module separation | P3 | Two unrelated responsibilities share one package |

## Dependencies on other packages

- No `@ts-linq/*` runtime dependencies (peerDependencies empty). It is a leaf
  utility consumed by `@ts-linq/cache` (`safeCacheEvicted`) and the cache
  adapters/loggers indirectly.

## Testing strategy

- Unit: `tryInvoke`/`safeX` never throw when the logger is `undefined`, missing
  the method, or throws; debug-gated `console.warn` only fires with
  `TSL_METRICS_DEBUG` set.
- Type tests (`test-d`): assert the real exported signatures of `safeCache` etc.
  and `MemoryProfiler`.
- `MemoryProfiler` unit tests already exist; keep them.

## Notes

The safe-invoke pattern is sound (a defensive **Null Object**-ish guard for
optional telemetry) — the issue is that it is hard-wired to three events instead
of being a reusable wrapper. The stale `test-d` is the most concrete, must-fix
defect.
