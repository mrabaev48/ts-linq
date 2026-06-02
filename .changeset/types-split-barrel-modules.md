---
"@ts-linq/types": patch
---

refactor: split 1275-line index.ts barrel into cohesive concern modules (no public API change)

The 1275-line mega-barrel `packages/types/src/index.ts` has been reorganized into 15 focused
concern modules: `sql.ts`, `logging.ts`, `dialect.ts`, `middleware.ts`, `config.ts`,
`query-filters.ts`, `results.ts`, `cache.ts`, `value-conversion.ts`, `metadata.ts`,
`stored-procedure.ts`, `tracking.ts`, `spatial-hierarchy.ts`, `diagnostics.ts`, `scaffolding.ts`.
`index.ts` is now a thin re-export barrel. All previously exported names remain available at
`@ts-linq/types` — zero consumer changes required.
