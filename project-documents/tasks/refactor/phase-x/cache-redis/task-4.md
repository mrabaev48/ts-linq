---
status: not-started
phase: phase-x
package: cache-redis
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: ["cache-redis/task-1.md"]
related: ["cache-memcached/task-3.md"]
---

# Refactor: Unify backend-failure degradation policy and route through SqlLogger

## Problem

Backend (Redis) I/O failures are handled three different ways across the
adapters: silently swallowed, `console.warn`'d, or ignored. None of them notify
the ORM's observability layer (`SqlLogger`). A network blip is therefore either
invisible or noisy on stdout, with no consistent, configurable policy.

## Evidence

Classification of each catch in cache-redis:

- `RedisSqlCacheAdapter.set()` write-through catch — `RedisSqlCacheAdapter.ts:155`
  `// Ignore write-through errors` → **valid recovery** (write failure degrades
  to shadow-only) BUT **unreported** (no telemetry).
- `RedisSqlCacheAdapter.getAsync()` catch — `:134` returns `undefined` →
  **valid recovery** (read failure = cache miss) but unreported.
- `RedisSqlCacheAdapter.invalidateBy()` del catch — `:182` → valid cleanup,
  unreported.
- `RedisCountCacheAdapter.set()` catch — `RedisCountCacheAdapter.ts:138`
  `console.warn(...)` → valid recovery but **inconsistent** (uses console,
  unlike the Sql/Entity adapters which are silent).
- `RedisCountCacheAdapter.invalidateBy()` del catch — `:160` `console.warn`.
- `RedisEntityCacheAdapter.set()` write-through catch — `:146` silent.
- `RedisEntityCacheAdapter.remove()` del catch — `:161` silent.
- `RedisEntityCacheAdapter.triggerAsyncFetch()` catch — `:193` silent.
- pub/sub message-parse catch — `RedisSqlCacheAdapter.ts:79`,
  `RedisCountCacheAdapter.ts:68` `catch {}` → swallows malformed invalidation
  messages silently (could mask a real protocol mismatch).

Net: identical failure classes, three different (inconsistent) policies, none
surfaced to `SqlLogger`.

## Why this is bad

- **Inconsistent error handling** across sibling classes — violates the
  principle of least surprise and CLAUDE.md error-handling rules.
- **`console.warn` from a library** pollutes consumer stdout, is not
  level-controlled, and cannot be routed/suppressed.
- **Unobservable degradation.** When Redis is down, the ORM keeps working
  (good — valid recovery) but operators get no metric/log, so a degraded cache
  tier is invisible. The cluster already has a `fallback`/`cacheEvicted`
  telemetry vocabulary (`SqlLogger.fallback`, `metrics-safe.safeCache*`) that
  these adapters ignore.

## Target architecture

A single, injectable degradation policy used by the shared base (from task-1):

- Inject an optional `SqlLogger` (or the `metrics-safe` safe-invoke helpers) into
  the base adapter. On any backend failure, emit a structured event
  (`fallback`/`cache` with `succeeded:false`/`error`) via the safe wrapper, then
  degrade to the cache-miss/shadow-only path. Never throw to the caller, never
  `console.warn`.
- This applies **SRP** (failure policy is one concern in the base), **DIP**
  (depends on the `SqlLogger` abstraction), and the **Null Object** pattern (a
  no-op logger default so the path is branch-free).
- Keep the *behaviour* (degrade to miss) — that is correct recovery — but make
  it consistent and observable.

## Proposed refactor

1. Add an optional `logger?: SqlLogger` option to the shared base adapter.
2. Replace every `console.warn` and bare `catch {}` on backend I/O with a single
   `this.reportDegradation(op, error)` that calls `safeCache`/`fallback` through
   `@ts-linq/metrics-safe` (which already guards against logger errors).
3. For pub/sub parse failures, emit a distinct low-severity event instead of
   silent `catch {}`, so a protocol mismatch is detectable.
4. Remove all direct `console.warn` from the package.

## Suggested design patterns

- **Null Object:** default no-op logger removes `if (logger)` noise.
- **DIP:** depend on `SqlLogger`/safe-metrics abstraction.
- **Single policy (DRY):** one `reportDegradation` in the base, not per adapter.

## Testing plan

- Error-path unit: transport `set` rejects → `reportDegradation` invoked once
  with a fallback/cache event; no exception thrown; shadow value still present.
- Error-path unit: transport `get` rejects → returns miss + event emitted.
- Negative: a throwing logger does not break the cache (covered by metrics-safe's
  `tryInvoke` guard) — assert cache still degrades cleanly.
- Assert no `console.*` is called by the adapters.

## Acceptance criteria

- [ ] No `console.warn`/`console.*` remains in cache-redis adapters.
- [ ] All backend I/O failures degrade to miss/shadow-only AND emit a single,
      consistent telemetry event through `SqlLogger`/metrics-safe.
- [ ] pub/sub parse failures emit an event instead of silent `catch {}`.
- [ ] A throwing logger cannot break cache behaviour (test).

## Refactor order

1. Land task-1 (shared base) so the policy lives in one place.
2. Add logger injection + `reportDegradation`.
3. Replace all catches; delete console.warn.

## Notes

Error-handling classification: the current *behaviour* (network error → cache
miss) is VALID recovery and must be preserved. The defects are (a) inconsistency
across adapters, (b) `console.warn` from a library, and (c) zero observability of
a degraded cache tier. This is not an "invalid silent swallow that returns wrong
data" — it returns a miss, which is safe — but it is an "unreported degradation",
which is its own (P1) anti-pattern given the cluster ships a telemetry vocabulary
for exactly this.
