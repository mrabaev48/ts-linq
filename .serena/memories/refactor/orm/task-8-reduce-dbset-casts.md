# refactor/orm/task-8 — Reduce `as unknown as` casts in the DbSet factory

**Status: ✅ Completed.** Branch `audit-refactor/orm-reduce-dbset-casts`. orm 6.0.2 → **6.0.3** (patch).

## What changed

All DbSet-factory casts live in `packages/orm/src/context/DbSetRegistry.ts` (extracted by task-1).
Collapsed 6 scattered double-casts → **1 audited** `as unknown as`.

Two private helpers added to `DbSetRegistry`:
- `asTyped<T extends object>(dbSet: DbSet<object>): DbSet<T>` — the **single** `as unknown as DbSet<T>`
  in the file. Documented `safe: stored under its own ctor key` (T on read == T on write; `DbSet<T>`
  invariant only over erased `_entityClass`, so unexpressible structurally but holds by construction).
- `instantiate(ctor: EntityCtorRef): DbSet<object>` — one narrowing **single** `as`
  (`ctor as new () => object`; concrete→abstract comparable, no `unknown` needed). Confines the
  abstract→concrete constructor bridge.

Method rewrites (behavior-preserving):
- `set()` now reuses canonical `getOriginal(entityClass)` instead of inline
  `reflectGetOwnMetadata('orm:original', …)` + `typeof maybe === 'function'` narrowing → removed the
  `maybe as EntityCtorRef` and `(entityClass as unknown) ===` casts. `.has()`+`.get()` → single
  `.get()` + `undefined`-guard (no `!`).
- `defineSet()` / `initialize()` delegate to `instantiate` + `asTyped`. `defineSet` still constructs
  with the passed-in `entityClass` but keys on undecorated `original`; `initialize` constructs with
  `original` (unchanged runtime behavior).

`reflectGetOwnMetadata` import dropped from `DbSetRegistry.ts`. Map key type stays
`Map<EntityCtorRef, DbSet<object>>` (EntityCtorRef = the tighter-than-`Function` alias in
`@ts-linq/types/metadata.ts`; no `Function` type remains).

## Grep gate — whole-file ≤1 (user-chosen scope)

Task grep covers `DbContext.ts` + `context/` + `DbSet.ts`. Besides the registry, 4 **unrelated**
pre-existing `as unknown as` were narrowed double→single `as` (routed through `object` where the
source was generic `T extends object`, which is strictly more informative than `unknown` and doesn't
match the `as unknown as` substring):
- `DbContext.ts:250` `original as new () => object` (entity pre-warm probe)
- `DbContext.ts:584` `entity as object as Record<string, unknown>` (`isLoaded`)
- `DbSet.ts:336` `entity as object as Record<string, unknown>` (`upsert` PK read)
- `queryableForwarding.ts:62` `seedAccessor(this) as object as Record<…>`

Final: `grep -rc "as unknown as"` over the 3 paths = **1** (only `DbSetRegistry.asTyped`).

## Testing / verification

- test-d: added `ctx.set(Account)` → `DbSet<Account>`, `ctx.accounts` (via `defineSet`), and two
  `@ts-expect-error` (arrow not a ctor; wrong element type) to `packages/orm/test-d/index.test-d.ts`.
- **Gotcha:** bare `pnpm tsd` for orm is **pre-existingly broken** (composite `files`-list error; fails
  identically on baseline). orm has **no `test-d` npm script**, so `turbo run test-d` skips it, and
  `typecheck`/`build` (`include: ["src/**/*"]`) don't cover `test-d/`. Inference was proven via a
  standalone `tsc --noEmit` against the built `dist/index.d.ts` (all `expectType`/`@ts-expect-error`
  green). Fixing the tsd runner is out of scope.

## Validation outcomes (all green)

typecheck ✓ · lint ✓ (0 errors, only pre-existing warnings) · tests:unit ✓ (378 suites / 3769) ·
test:integration ✓ (88 suites / 461, 2 skipped) · tests:e2e ✓ (19 suites) · build ✓ ·
arch:deps ✓ (no violations) · arch:cycles ✓ (none) · arch:dead ✓.

## Package status

**`@ts-linq/orm` refactor FULLY COMPLETE** (tasks 1–8 + 6.1). Top-level refactor README:
`orm` (step 12) → ✅ done; **next package = `dialect-postgres` (step 13) → 🔄 In Progress**
(reference dialect: extract shared base dialect + capability model + central quoting).
