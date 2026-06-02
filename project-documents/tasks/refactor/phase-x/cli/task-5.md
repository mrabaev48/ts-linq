---
status: not-started
phase: phase-x
package: cli
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["cli/task-2.md"]
---

# Refactor: Move schema-introspection SQL out of the CLI (and fix the BASE TABLE bug)

## Problem

`schema-inspect.ts` embeds raw, per-dialect introspection SQL and type-mapping directly in
the CLI package. This duplicates capability that already exists in `@ts-linq/migrations`
(`SchemaInspector`) and in the dialect introspectors used by scaffolding
(`PostgresDbIntrospector`, etc.). It is a package-boundary violation (dialect/provider logic
in the generic CLI), it has drifted from those implementations, and it contains a
correctness bug in the table-listing query for MySQL/MSSQL.

## Evidence

- `packages/cli/src/schema-inspect.ts:15-47` — `mapPostgres`/`mapMySql`/`mapMssql` reimplement
  dialect type normalization (overlapping `migrations/src/builders/SqlUtils.ts` and the
  dialect packages).
- `packages/cli/src/schema-inspect.ts:71-158` — `inspectTable` issues hand-written
  `information_schema`/`sys` queries per dialect, duplicating `SchemaInspector` /
  `DbIntrospector` logic.
- `packages/cli/src/schema-inspect.ts:160-185` — `listAllTables` duplicates
  `PostgresSchemaInspector.listTables` etc.
- **Bug:** `packages/cli/src/schema-inspect.ts:175` and `:181` use a double-quoted SQL string
  literal `TABLE_TYPE = "BASE TABLE"`. In MSSQL (and ANSI mode), double quotes denote an
  *identifier*, so this filters on a column/identifier named `BASE TABLE`, not the string —
  it should be single-quoted `'BASE TABLE'`. MySQL tolerates it by default but it is still
  wrong/fragile.
- `packages/cli/src/schema-inspect.ts:118,135` — uses `?` (MySQL) and `@p1`/`@p2` (MSSQL)
  placeholders inline, embedding provider-specific parameter syntax in the CLI.

## Why this is bad

- **Boundary violation:** the CLI should orchestrate, not own dialect SQL; this belongs in
  migrations/dialect packages where it is already tested.
- **Duplication/drift:** three sources of introspection logic that can disagree.
- **Correctness:** the `"BASE TABLE"` literal is a latent MSSQL bug.
- **Maintainability:** a new dialect or schema-catalog change must be fixed in multiple
  packages.

## Target architecture

Apply **package-boundary** discipline and **DRY**: the CLI depends on an introspection
abstraction exposed by `@ts-linq/migrations` (or the dialect packages), and contains no raw
catalog SQL.

- Reuse the existing `DbIntrospector` (already consumed by `ScaffoldCommand`) and/or
  `SchemaInspector` to provide `listTables` + column/PK details.
- If the inspect command needs richer column info than the current introspectors expose,
  extend the introspector interface in the owning package — not the CLI.
- Delete `schema-inspect.ts`'s dialect SQL; keep only CLI-level formatting/presentation.

## Proposed refactor

1. Inventory what `inspectTable`/`listAllTables` produce vs what `DbIntrospector`/
   `SchemaInspector` already return.
2. Extend the introspector contract in `@ts-linq/migrations`/dialect packages to cover any
   gap (column db-type, nullability, PK flag).
3. Replace `schema-inspect.ts` internals with calls to those abstractions, selected via the
   factory from migrations/task-6 (single dialect dispatch).
4. Fix the `"BASE TABLE"` → `'BASE TABLE'` bug in whichever owning implementation needs it
   (add a regression test).
5. Keep the CLI presentation (the `{ name, dbType, ormType, nullable, isPrimary }` shape) as
   a thin mapping over the abstraction's output.

## Suggested design patterns

- **Dependency inversion** — CLI depends on the introspection interface, not raw SQL. Why:
  removes boundary violation; testable with fakes.
- **Adapter** — map introspector output to the CLI's presentation shape. Why: keeps
  presentation in the CLI, data access in the owning package.

## Testing plan

- **Regression:** `tests/schema-inspect.test.ts` passes against the refactored path
  (presentation unchanged).
- **Bug regression:** a test asserting the table-listing query uses a string literal
  (`'BASE TABLE'`) in the owning package.
- **Contract:** introspector returns the column fields the CLI presents, per dialect (fakes).

## Acceptance criteria

- [ ] No raw `information_schema`/`sys`/`pg_*` SQL remains in `packages/cli`.
- [ ] The CLI consumes the introspection abstraction (single dialect dispatch).
- [ ] The `"BASE TABLE"` literal bug is fixed in the owning package with a regression test.
- [ ] CLI presentation output shape is unchanged.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build`, `pnpm arch:deps` pass.

## Refactor order

1. Gap analysis vs existing introspectors.
2. Extend the introspector contract if needed (owning package).
3. Replace CLI internals; fix the literal bug; keep presentation.

## Notes

Coordinate with migrations/task-6 (the dialect-inspector factory) so the CLI uses one
selection mechanism. If the inspect command's needs are minor, prefer extending
`DbIntrospector` (already a CLI dependency via scaffold) over `SchemaInspector`.
