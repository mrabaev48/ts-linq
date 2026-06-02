# Refactor Audit: _shared (cross-cutting plugin findings)

## Package responsibility

This folder is not a package. It collects findings that span **all three plugins**
(`plugin-audit`, `plugin-multi-tenant`, `plugin-soft-delete`) and the integration packages,
where the root cause is a single shared architectural defect rather than a per-package bug.

The three plugins were clearly authored from one template: identical file layout
(`<X>Middleware.ts`, `types.ts`, `utils.ts`, `index.ts`), identical option-defaulting pattern
(constructor spread of defaults), identical `MetadataStorage.getEntity` column probing, identical
re-export of a same-named interface aliased to `I<X>Middleware`, identical dual test directories
(`tests/` + dead `tests-new/`), and identical broken ESM build script. Fixing each defect once
per plugin triples the work and guarantees drift. These shared tasks describe the systemic fixes;
per-package task files reference them via `related`.

## Current architectural problems

1. **The extension-point contract is a lie.** `OrmMiddleware` (packages/types/src/index.ts:331)
   declares entity-lifecycle hooks `beforeSave/afterSave/beforeDelete/afterDelete`, but the runtime
   (`DatabaseProvider`, packages/core/src/DatabaseProvider.ts) only ever invokes
   `beforeExecute/afterExecute/entityMaterialized/analysis`. The lifecycle hooks are dead contract.
2. **None of the three plugins actually implement `OrmMiddleware`.** Each `<X>Middleware` *class*
   exposes bespoke imperative methods (`applyAudit`, `handleSoftDelete`, `applyTenant`) that no ORM
   code path calls. The plugins are orphaned — no package depends on them.
3. **A same-named `interface` shadows the exported `class`.** Each `types.ts` declares
   `export interface <X>Middleware extends OrmMiddleware` with hooks the class never implements,
   then `index.ts` re-exports it as `I<X>Middleware`. Two unrelated shapes share one name.
4. **Plugins mutate caller entities in place** with no immutability contract or return value
   describing what changed (audit & tenant write onto `context.entity`; soft-delete flips flags).
5. **Raw SQL string assembly inside plugins** — including tenant-id string interpolation
   (SQL-injection class) — bypasses the provider's parameterization and dialect layer.
6. **Broken ESM build** — every plugin advertises `module`/`exports.import` →
   `./dist/index.esm.js` but `build` only emits CJS.
7. **Dead second test suite** — `tests-new/` is never run by the jest config
   (roots = `<rootDir>/tests`).
8. **Duplicated, drifting config shapes** — `SoftDeleteOptions` exists both in
   `@ts-linq/types` and in `plugin-soft-delete`, with different fields.

## Refactor goals

- Define ONE honest, documented extension-point contract (Ports & Adapters) and make the runtime
  actually drive it, OR formally retire the plugins as a parallel/abandoned mechanism.
- Eliminate template duplication via a shared plugin-kit (option defaulting, metadata column probe,
  immutability-respecting mutation, Null Object for "no current user/tenant").
- Remove raw SQL from plugins; emit predicate AST / parameterized fragments via the provider.
- Make build + test config correct and uniform.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md Decide & unify the plugin extension-point contract | P0 | Everything else depends on whether plugins live or die |
| 2 | task-2.md Extract shared plugin-kit (kill template duplication) | P1 | Stops drift across 3 plugins |
| 3 | task-3.md Fix broken ESM build across plugins | P1 | Shipped `import` entry points to a non-existent file |
| 4 | task-4.md Remove dead `tests-new/` or wire it into jest | P2 | ~400 lines of tests never execute |
| 5 | task-5.md Consolidate duplicated `SoftDeleteOptions`/config types | P2 | Two diverging definitions of one concept |

## Dependencies on other packages

- `@ts-linq/types` — owns `OrmMiddleware`, `EntityChangeContext`, `SoftDeleteOptions`.
- `@ts-linq/core` — `DatabaseProvider` is the only middleware driver today.
- `@ts-linq/orm` — `DbContext` already has a working `SoftDeleteInterceptor` that duplicates the plugin.
- `@ts-linq/metadata` — `MetadataStorage.getEntity` is the column-probe source.

## Testing strategy

- Contract tests for the chosen extension-point port (one suite, run against every plugin adapter).
- Error-path tests (missing metadata, missing user/tenant, strict vs lax).
- Build smoke test asserting `dist/index.esm.js` exists and is importable.

## Notes

The single most important decision is task-1: today the plugins are a **second, dead** middleware
mechanism living beside the **real, wired** `SoftDeleteInterceptor`/interceptor pipeline in
`@ts-linq/orm`. The audit recommends collapsing to one mechanism.
