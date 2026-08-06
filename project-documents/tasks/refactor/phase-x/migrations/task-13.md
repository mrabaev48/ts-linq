---
status: not-started
phase: phase-x
package: migrations
priority: P3
effort: S
risk: low
category: performance
depends_on: ['dialect-postgres/task-10.md']
related: []
---

# Refactor: stop eagerly loading all three dialect barrels from `@ts-linq/migrations`

## Problem

`dialect-postgres/task-10` gave `@ts-linq/migrations` a composition root
(`builders/ddl/DdlStrategyFactory.ts`) that imports the three dialect packages. It needs exactly six
symbols — `{Postgres,MySql,Mssql}DdlStrategy` and their `TypeMapper`s — but each dialect exposes only
a `"."` entrypoint whose barrel is `export *`. So importing `@ts-linq/migrations` now evaluates all
three dialects in full: introspectors, JSON-path translators, spatial/ltree/hierarchy function
tables, option builders and the `*Dialect` classes (which transitively pull `@ts-linq/sql-visitor`
and `@ts-linq/dialect-kit`).

A PostgreSQL-only consumer pays MySQL and SQL Server module evaluation on every import, and bundlers
cannot tree-shake past the `export *` barrels.

## Evidence

- `packages/migrations/src/builders/ddl/DdlStrategyFactory.ts:1-3` — the three barrel imports.
- The factory is reachable from the package entrypoint through both
  `builders/handlers/TableHandlers.ts` and `builders/UniqueConstraintsSqlBuilder.ts`, so it is
  never lazy.
- `packages/dialect-postgres/package.json` (and the two siblings) — `exports` declares `"."` only.
- `packages/migrations/package.json` — the three dialects moved `devDependencies → dependencies` in
  `dialect-postgres/task-10`, so they are now transitive runtime deps of `@ts-linq/orm` and
  `@ts-linq/cli` too.

## Why this is bad

- Import cost and bundle size for every consumer of `@ts-linq/orm` / `@ts-linq/cli`, in exchange for
  six classes.
- The dependency is architecturally correct (one composition root, contract-based downstream) but
  its *packaging* is coarser than it needs to be.

## Target architecture

Add a narrow subpath export to each dialect — e.g. `@ts-linq/dialect-postgres/ddl` re-exporting only
`PostgresDdlStrategy` + `PostgresTypeMapper` — and have the factory deep-import that. This mirrors
the existing precedent for narrow subpaths in this repo (`@ts-linq/metrics-safe/memory`,
`@ts-linq/query/internal`, `@ts-linq/sql-visitor/internal`).

Do **not** solve this with `await import(...)`: `createDdlStrategy` is synchronous and called from
synchronous SQL generation, so making it async would ripple through the migration pipeline for no
architectural gain.

## Proposed refactor

1. Add `src/ddl.ts` (or equivalent) to each dialect exporting just the strategy + type mapper, and
   declare the `./ddl` subpath in each `package.json` `exports` map (CJS + ESM + types), matching the
   existing subpath entries elsewhere in the repo.
2. Point `DdlStrategyFactory` at the subpaths.
3. Confirm the `no-private-package-internals` dependency-cruiser rule still passes — a declared
   subpath entrypoint is a public entrypoint, not an internal reach-in.
4. Measure: module count / evaluation on `require('@ts-linq/migrations')` before and after.

## Testing plan

- **Build:** all three dialects and migrations build under CJS and ESM; the copied `.d.ts` for the
  new subpath resolves (`scripts/copy-types.js`).
- **Regression:** the `ddl-convergence.golden.test.ts` golden is unchanged — this is packaging only,
  with no effect on emitted SQL.
- **Arch:** `arch:deps`, `arch:cycles`, `arch:dead` stay clean.

## Acceptance criteria

- [ ] `DdlStrategyFactory` imports narrow subpaths, not the dialect barrels.
- [ ] Importing `@ts-linq/migrations` no longer evaluates the dialect introspectors / function tables.
- [ ] Emitted SQL unchanged (golden untouched).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm build`, `arch:*` pass.

## Notes

Recorded as residual debt in the `dialect-postgres` README under the task-10 convergence section.
Lowest-priority of the task-10 follow-ups: it is pure packaging, with no correctness impact.
