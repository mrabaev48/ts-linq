# refactor/core/task-8 — Logger injection / no console (✅ DONE)

Branch `audit-refactor/core-logger-injection-no-console`. `@ts-linq/core` **minor** +
`@ts-linq/orm` **patch**. core 3.2.0→3.3.0, orm 4.0.15→4.0.16.

## Goal
Remove default console output + static logger global from core. Library-hygiene clean-code fix
(Null Object silent default + DI + Strategy sinks). No console unless host opts in.

## What changed

### `packages/core/src/utils/InternalLogger.ts` — Null Object + global hook
- Unconditional `console.error` **removed**.
- Unified channel `logInternalError(context, error)` signature **preserved byte-for-byte**
  (task-5 channel — extended, not forked). It now dispatches to a single module-level handler
  that defaults to **no-op** (silent Null Object). Never throws.
- New: `setInternalErrorHandler(next?: InternalErrorHandler)` (opt-in / `undefined` = silent)
  and exported type `InternalErrorHandler = (context: string, error: unknown) => void`.
- **No console handler shipped in core** — the host owns any console dependency (keeps core
  literally console-free; `grep -rn "console\." packages/core/src` non-test = empty).
- `InternalLogger` is NOT in the core barrel (`index.ts:88 // Removed`) — kept internal; the
  setter is the in-repo composition seam.

### `packages/core/src/loading/LazyLoadingProxy.ts` — kill static, inject via params
- Removed `private static _logger`, `static setLogger`, `private static getLogger` (none were
  called anywhere outside the class — default was always `console.warn`; safe removal).
- New exported `interface LazyLoadingLogger { warn(message, error?): void }` (this is the
  **new public type** → drives the `minor`) + module-const `NO_OP_LAZY_LOADING_LOGGER`.
- `create` / `createMany` / `preloadRelationships` gain an **optional trailing**
  `logger: LazyLoadingLogger = NO_OP_LAZY_LOADING_LOGGER` (back-compat). Threaded into
  `buildProxyTraps(..., (msg, err) => logger.warn(msg, err))` and the recursive
  create/createMany RelationshipLoader callbacks. Aligns with task-2 MetadataSource injection.

### `packages/orm/src/DbContext.ts` — composition-root opt-in (the actual wiring)
- `include()` adapts the context `SqlLogger` from `this._provider.loggerRef` (set from
  `options.logging`) into the lazy logger:
  `{ warn: (m, e) => loggerRef.warn(m, { error: e }) }`, passed to `preloadRelationships`.
  If no logger configured → `undefined` → silent Null Object default.

## Tests
- Rewrote `tests-new/InternalLogger.test.ts` (old test asserted console.error by default — that
  was the old behaviour; updated, not weakened): silent-by-default (console spy 0 calls),
  injected handler receives `(context, error)`, never throws even if handler throws.
- New `tests-new/LazyLoadingProxy.logger.test.ts`: default-silent + injected-sink on the
  failure path (mock provider `findById` rejects → ToOneStrategy → catch → logger.warn).
- Updated isolation tests `MiddlewareDispatcher` / `InterceptorDispatcher` / `CompositeSqlLogger`
  to install `setInternalErrorHandler(spy)` and assert the swallowed error reaches the handler
  (instead of `console.error`).

## Gotchas
- orm typecheck reads `@ts-linq/core` from `dist` .d.ts → **rebuild core** after changing the
  public signature before `pnpm typecheck` (else TS2554 "Expected 4-5 args, got 6").
- Scripts: `pnpm test:unit` / `test:integration` / `test:e2e` (NOT `tests:*`).
  Integration/e2e foreground only.

## Validation (all green)
typecheck ✅ · lint ✅ (0 err) · unit ✅ 3186 · integration ✅ 464 (+2 skip) · e2e ✅ 290 ·
build ✅ · arch:deps ✅ · arch:cycles ✅ · arch:dead ✅.

## Next
core task-9 (curate `export *` barrel) is the last remaining core task. Package stays
🔄 In Progress.
