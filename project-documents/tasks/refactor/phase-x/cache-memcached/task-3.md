---
status: not-started
phase: phase-x
package: cache-memcached
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: []
related: ["cache-redis/task-3.md"]
---

# Refactor: Fix silently-incomplete clear() that leaves remote entries stale

## Problem

`MemcachedEntityCacheAdapter.clear()` and `MemcachedSqlCacheAdapter.clear()`
clear only the local shadow Map and intentionally do nothing to the remote
Memcached store. A caller invoking `clear()` to invalidate the cache will find
stale entries still in Memcached, which repopulate the shadow on the next
`getAsync`. The contract method name implies full invalidation; the behaviour is
shadow-only.

## Evidence

- `MemcachedEntityCacheAdapter.clear()` — `MemcachedEntityCacheAdapter.ts:122-127`:
  body only `this.shadow.clear();` with a comment
  `// Memcached doesn't support easy "clear by prefix" without flush_all which is dangerous`.
- `MemcachedSqlCacheAdapter.clear()` — `MemcachedSqlCacheAdapter.ts:131-135`:
  clears shadow, bumps `invalidations`, no remote delete.
- `MemcachedCountCacheAdapter.clear()` — `MemcachedCountCacheAdapter.ts:129-133`:
  same shadow-only behaviour.
- Contrast: the Redis adapters' `clear()` at least broadcasts a `clear` message
  over pub/sub (`RedisSqlCacheAdapter.ts:161-166`) to evict *other* nodes'
  shadows — Memcached has no such mechanism, so remote data is wholly untouched.
- The remote value resurfaces: `getAsync` re-hydrates the shadow from Memcached
  (`MemcachedSqlCacheAdapter.ts:94-110`).

## Why this is bad

- **Silent semantic gap.** `clear()` on a cache is reasonably expected to empty
  the cache. Returning to a "cleared" cache and still reading old values is a
  correctness surprise that can serve **stale data** after an explicit
  invalidation — the most dangerous class of cache bug. (Note: this is NOT a
  swallowed-network-error case; it is an intentional no-op that misrepresents the
  method's contract.)
- **Inconsistent with Redis.** Same method name, materially different guarantees
  across backends, violating Liskov for code written against the cache contract.

## Target architecture

Make the contract honest and the behaviour intentional:

- Track the set of keys this adapter has written (or maintain a key index) and
  issue per-key `client.delete` in `clear()` for keys it owns — bounded, safe,
  and prefix-respecting (no dangerous `flush_all`).
- OR, if remote clear is deliberately out of scope, rename/segregate the
  capability: keep `clear()` as documented shadow-only and add an explicit
  `clearRemote()`/`invalidateAll()` so callers choose consciously. Encode the
  guarantee in the contract (tie into `cache-redis/task-3` ISP work).
- Either way, document the chosen guarantee and assert it with a test, so the
  behaviour is a decision rather than an accident.

This applies **Clean Code** (honest naming), **LSP** (consistent guarantees), and
**ISP** (separate "clear shadow" from "clear everywhere" if they differ).

## Proposed refactor

1. Decide the guarantee (preferred: best-effort remote delete of locally-known
   keys; avoid `flush_all`).
2. Implement key tracking on the shared base (from cache-memcached/task-1) so all
   three roles inherit consistent `clear()` semantics.
3. Route remote-delete failures through the unified degradation policy
   (cache-redis/task-4): failure degrades quietly + emits telemetry, never throws.
4. Update docs/tests to lock the guarantee.

## Suggested design patterns

- **Template Method:** `clear()` defined once on the base, transport supplies
  `deleteRemote`.
- **ISP:** split shadow-clear vs remote-clear if guarantees must differ per
  backend.

## Testing plan

- Unit: after `set` + `clear`, a subsequent `getAsync` does NOT return the old
  value (with fake transport) — i.e. remote was cleared for known keys.
- If shadow-only is chosen instead: assert (deliberately) that `getAsync`
  re-hydrates, and that an explicit `clearRemote()` empties remote.
- Error-path: remote delete during `clear()` rejects → no throw, telemetry event.

## Acceptance criteria

- [ ] `clear()` semantics are explicit, documented, and test-locked.
- [ ] No path serves stale remote data after the documented invalidation API is
      called.
- [ ] Remote-delete failures degrade quietly with telemetry (no throw, no
      `console.warn`).
- [ ] Behaviour is consistent across the three Memcached roles.

## Refactor order

1. Decide guarantee.
2. Implement on shared base (after cache-memcached/task-1) with key tracking.
3. Wire telemetry (cache-redis/task-4).
4. Lock with tests.

## Notes

`risk: medium` because changing `clear()` to delete remote keys alters
observable behaviour for existing consumers. Prefer best-effort per-key delete
over `flush_all` (which would nuke unrelated tenants' keys in shared Memcached).
