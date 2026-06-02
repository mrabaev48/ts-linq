---
status: not-started
phase: phase-x
package: migrations
priority: P0
effort: M
risk: high
category: sql
depends_on: []
related: ["task-3.md", "task-7.md"]
---

# Refactor: Injection-safe identifier and literal quoting layer

## Problem

The single most-used SQL helper in the package quotes identifiers without escaping
embedded quote characters. Every DDL and seed/DML builder routes identifiers through it,
so any table/column/index/sequence name (or seed string value) that contains the dialect
quote character breaks out of quoting. This is both a correctness bug and an injection
vector when names are derived from a scaffolded/introspected database or from
user-controlled seed data.

## Evidence

- `packages/migrations/src/builders/SqlUtils.ts:3` — `q(dialect, id)` returns
  `'"' + id + '"'` / `` '`' + id + '`' `` / `'[' + id + ']'` with **no** escaping. A
  column named `a"b` yields `"a"b"`.
- `packages/migrations/src/builders/SqlUtils.ts:55` — `formatValue` escapes single quotes
  for strings (`.replace(/'/g, "''")`) but is inconsistent with identifier quoting and is
  the *only* place any escaping happens.
- `packages/migrations/src/builders/SeedsSqlBuilder.ts:27-52` — `buildInsert`/`buildUpdate`/
  `buildDelete` interpolate `q()` identifiers and `formatValue()` literals directly into
  `INSERT/UPDATE/DELETE`.
- `packages/migrations/src/builders/SequencesSqlBuilder.ts:64,68,80,105,142,156,158` —
  builds `"<schema>"."<name>"`, `[<schema>].[<name>]`, and MySQL
  `... WHERE \`name\` = '${op.sequence.name}'` / `VALUES ('${seq.name}', ${schemaVal}, …)`
  with raw template interpolation — no escaping at all.
- `packages/migrations/src/builders/MigrationHandlers.ts:322,324,339,341` —
  `buildAddUniqueConstraintSql`/`buildDropUniqueConstraintSql` build MySQL/MSSQL SQL with
  raw `` \`${tableName}\` `` / `[${tableName}]` interpolation bypassing `q()` entirely.

## Why this is bad

- **Security:** scaffolded names and seed values flow into emitted SQL. A crafted
  identifier or seed string can inject arbitrary SQL into a generated migration that an
  operator later runs with elevated DB privileges.
- **Correctness:** legitimate identifiers containing reserved quote chars silently
  produce malformed SQL.
- **Inconsistency:** two escaping conventions (escaped in `formatValue`, unescaped in
  `q`) and several builders that bypass `q()` make the behaviour unauditable.
- **Maintainability/extensibility:** adding a dialect means hunting every interpolation
  site instead of one quoting authority.

## Target architecture

Apply **Single Responsibility** and **dependency inversion**: introduce one quoting
authority per dialect behind a small interface, and forbid raw interpolation of
identifiers/literals anywhere else (composition-first — builders compose the quoter,
they do not re-implement it).

- New port `SqlQuoter` (Strategy):
  ```ts
  interface SqlQuoter {
    id(identifier: string): string;          // escapes + wraps
    qualified(...parts: string[]): string;   // schema.name, each escaped
    literal(value: unknown): string;         // delegates to typed literal encoder
  }
  ```
- Per-dialect implementations `PostgresQuoter`, `MySqlQuoter`, `MssqlQuoter` that double
  the dialect quote char (`"` → `""`, `` ` `` → ``` `` ```, `]` → `]]`).
- A `QuoterFactory.for(dialect): SqlQuoter`.
- `formatValue` is folded into `literal()` with a single, audited literal-encoding path.

This is Clean Architecture's "details at the edge": dialect-specific escaping is an
implementation detail behind a stable interface the builders depend on.

## Proposed refactor

1. Add `builders/quoting/SqlQuoter.ts` (interface) + `PostgresQuoter.ts` /
   `MySqlQuoter.ts` / `MssqlQuoter.ts` + `QuoterFactory.ts`.
2. Reimplement `q()` and `formatValue()` in `SqlUtils.ts` as thin delegates to the
   factory (keeps the existing exported signatures for backward compatibility).
3. Replace raw interpolation in `SequencesSqlBuilder`, `SeedsSqlBuilder`, and the
   `MigrationHandlers` unique-constraint builders with quoter calls.
4. Add an ESLint guard (or unit "no-raw-quote" test) that fails when a backtick/bracket
   identifier template appears outside the quoting layer.

Public API: `q` and `formatValue` keep their signatures; new types are additive.

## Suggested design patterns

- **Strategy** — one quoter per dialect, selected at runtime. Why: isolates the only
  security-sensitive transformation; new dialects add a class, not edits everywhere.
- **Factory** — `QuoterFactory.for(dialect)`. Why: single selection point, mirrors the
  existing `Dialect` union.
- **Facade** — keep `q`/`formatValue` as a thin facade for back-compat. Why: zero churn
  for existing callers.

## Testing plan

- **Contract/unit:** for each dialect, assert adversarial identifiers (`a"b`, `` a`b ``,
  `a]b`, `a'b`) are escaped and cannot break out.
- **Regression (golden SQL):** re-run existing `sequences-sql-builder` and
  `seed/SeedsSqlBuilder` tests; add cases with quote-containing names/values.
- **Property test (optional):** random identifier → quote → assert the wrapped form
  parses back to the original under each dialect's unquote rule.

## Acceptance criteria

- [ ] All identifier quoting goes through `SqlQuoter`; no builder interpolates a bare
      identifier into a quote char.
- [ ] Embedded quote characters are doubled per dialect and verified by tests.
- [ ] `q` and `formatValue` retain their current exported signatures.
- [ ] `SequencesSqlBuilder`, `SeedsSqlBuilder`, and the `MigrationHandlers` unique-constraint
      builders use the quoter.
- [ ] A lint/test guard prevents reintroducing raw identifier interpolation.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Introduce the quoter interface + per-dialect impls + factory.
2. Re-route `SqlUtils` through them.
3. Migrate the bypassing builders.
4. Add guard test/lint rule.

## Notes

Coordinate with task-3 (bundle/script code-gen also interpolates raw strings into
generated SQL) and task-7 (the `MigrationHandlers` cleanup will remove the bypassing
unique-constraint duplication).
