---
'@ts-linq/types': patch
---

refactor(types): isolate runtime values (ok/err/guards) and enums into dedicated modules; barrel surface unchanged

Internal reorganization of `@ts-linq/types`: the runtime helpers `ok`, `err` and
`isTemplateSqlCache` now live in `src/runtime.ts`, and the seven value-emitting enums
(`EntityState`, `LoadingStrategy`, `ValueGeneratedPolicy`, `DeleteBehavior`, `StorageStrategy`,
`InheritanceStrategy`, `QuerySplittingBehavior`) now live in `src/enums.ts`. Both modules are
re-exported from the `index.ts` barrel, so every previously exported name remains exported with
identical type and runtime identity — no consumer changes required. Enums are kept as regular
(non-`const`) string enums; cross-package `const enum` inlining is unsafe under the monorepo's
separate per-package builds.
