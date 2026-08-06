---
status: not-started
phase: phase-x
package: migrations
priority: P1
effort: S
risk: low
category: correctness
depends_on: []
related: ['dialect-postgres/task-10.md']
---

# Bug: snapshot CHECK constraints are captured but never emitted

## Problem

`hasCheckConstraint()` (P0-14) constraints survive into the schema snapshot and then vanish.
`TableSnapshot.checkConstraints` is populated from entity metadata but **no emitter reads it** — a
migration generated for an entity with CHECK constraints creates the table without them, silently.

The same model *does* get its CHECK constraints when the table is created through the provider's
`EnsureCreated` path, because `AbstractDdlStrategy.generateCreateTableSql` appends
`buildCheckConstraints(metadata)`. So the two table-creation paths in the product disagree.

## Evidence

- `packages/migrations/src/SchemaSnapshot.ts:166-167` — the only writer:
  `...(entityMeta.checkConstraints?.length ? { checkConstraints: entityMeta.checkConstraints } : {})`.
- `packages/migrations/src/DiffTypes.ts:55` — the only other mention (the field declaration).
- `grep -rn "checkConstraints" packages/migrations/src` returns exactly those two files: no
  comparator diffs it, no builder emits it.
- `packages/migrations/src/builders/handlers/TableHandlers.ts:77-90` (`buildCreateTableSql`) assembles
  columns + `PRIMARY KEY` + inline FKs, and no CHECK clause.
- `packages/dialect-kit/src/ddl/AbstractDdlStrategy.ts` — `buildCheckConstraints` exists and is used
  by `generateCreateTableSql`, i.e. the shared strategy already knows how to render them.
- `dialect-postgres/task-10` removed `ColumnHandlers.renderCheckConstraint`, which was exported but
  had **zero callers** — the dead helper was the residue of this gap.

## Why this is bad

- A declared domain invariant is silently dropped: the database accepts rows the model forbids.
- The failure is invisible — no error, no warning, and the generated migration looks complete.
- `EnsureCreated` and migrations produce different schemas from the same model, so a bug only
  reproduces on one of the two paths.

## Target architecture

Emit CHECK constraints from the shared `DdlStrategy`, not from a new migrations-local emitter.
`AbstractDdlStrategy.buildCheckConstraints` is `protected`; promote it to the `DdlStrategy` contract
alongside `generatePrimaryKeyClause` (added by `dialect-postgres/task-10` for exactly this reason)
so `buildCreateTableSql` can append the clauses it returns.

Diffing CHECK constraints on an *existing* table (add/drop on ALTER) is a separate, larger concern —
this task covers the CREATE TABLE path only, and should state explicitly whether the ALTER path is
in or out of scope.

## Proposed refactor

1. Add `generateCheckConstraints(metadata): string[]` to `DdlStrategy` in `@ts-linq/types`
   (`minor`), promoting the existing `AbstractDdlStrategy` implementation.
2. In `buildCreateTableSql`, append those clauses after the `PRIMARY KEY` clause and before the
   inline FKs — verify the ordering the strategy itself uses so both paths match.
3. Extend the fixture in `tests-new/builders/__fixtures__/ddl-convergence-fixture.ts` (it already
   declares `checkConstraints`, currently unasserted) and update the golden.
4. Decide and document whether `SchemaComparator` should diff check constraints; if out of scope,
   file it.

## Testing plan

- **Regression:** the `ddl-convergence.golden.test.ts` golden changes — this is an intentional,
  documented output change (new `CONSTRAINT … CHECK (…)` clauses), not a byte-preserving refactor.
- **Cross-path:** assert the migrations CREATE TABLE and `AbstractDdlStrategy.generateCreateTableSql`
  render the same CHECK clause for the same metadata.
- **Integration:** apply a migration for an entity with a CHECK constraint against all three
  containers and assert the constraint exists (and rejects a violating row).

## Acceptance criteria

- [ ] CHECK constraints declared via `hasCheckConstraint()` appear in generated CREATE TABLE DDL.
- [ ] The clause is produced by the shared `DdlStrategy`, not re-implemented in migrations.
- [ ] Golden updated with the output change documented in the PR.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`,
      `arch:*` pass.

## Notes

Found while auditing `dialect-postgres/task-10`. That task deliberately preserved output byte-for-byte
and therefore could not fix this — closing the gap *is* an output change and needs its own PR.
