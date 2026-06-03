---
'@ts-linq/metrics-safe': minor
---

feat(metrics-safe): generic safeInvoke / SafeSqlLogger safe-invoke abstraction (OCP)

Generalize the hard-wired safe-metrics helper into an extensible, type-safe
abstraction. The former `tryInvoke` (a closed `'cache' | 'cacheSize' |
'cacheEvicted'` method union) is replaced internally by a single guarded
`invokeSafely` core, and two new public symbols are added:

- `safeInvoke<M extends keyof SqlLogger>(logger, method, ...args)` — a generic,
  type-safe primitive that checks the method name and its arguments against the
  `SqlLogger` contract, then invokes the (possibly absent, possibly throwing)
  method without ever propagating an error. New safely-invoked events are added by
  *calling* it — no edit to any closed union (OCP / DIP).
- `SafeSqlLogger` — a Decorator that wraps any `SqlLogger` so every method is
  guarded once; callers hold a logger that "can never throw" (Decorator + Null-Object).

`safeCache`, `safeCacheSize`, and `safeCacheEvicted` are preserved with identical
signatures and behaviour (re-expressed over the shared core), so existing callers
are unaffected. Additive and backward compatible.

`safeInvoke`/`SafeSqlLogger` are typed against `SqlLogger` via a type-only
`import type` from `@ts-linq/types`, which is fully erased at build time — the
package keeps zero runtime dependencies.
