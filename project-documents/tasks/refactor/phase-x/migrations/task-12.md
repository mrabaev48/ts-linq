---
status: not-started
phase: phase-x
package: migrations
priority: P2
effort: M
risk: medium
category: package-boundary
depends_on: ['dialect-postgres/task-10.md']
related: ['dialect-postgres/task-11.md']
---

# Refactor: reconcile the snapshot type vocabulary with the dialect `TypeMapper`s

## Problem

`dialect-postgres/task-10` put migrations on the dialect `TypeMapper`s, but only for ten of the
logical types. `SnapshotTypeMapper` hard-codes the set
`INTEGER|NUMBER|TEXT|STRING|BOOLEAN|DATETIME|DATE|REAL|FLOAT|DOUBLE` and passes everything else
through untouched. The dialect mappers additionally recognize `BLOB`, `UUID`, `JSON` and `JSONB` —
so for those four, migrations and the dialects still disagree, and nothing links the two lists.

The decorator exists because `TypeMapper.mapType` cannot say *"I don't recognize this"*: each mapper
bakes in a `TEXT` / `NVARCHAR(MAX)` fallback, so a caller that needs to distinguish "logical type" from
"physical type the author wrote by hand" (`VARCHAR(255)`, `DECIMAL(10,2)`) must re-derive the
recognized set. That re-derivation is the duplication.

## Evidence

- `packages/migrations/src/builders/ddl/SnapshotTypeMapper.ts` — `LOGICAL_TYPES`, with the omission
  documented as deliberate.
- `packages/dialect-postgres/src/PostgresTypeMapper.ts:5-20` — `MAP` includes `BLOB: 'BYTEA'`,
  `UUID: 'UUID'`, `JSONB`, `JSON`; `packages/dialect-mssql/src/MssqlTypeMapper.ts:34-41` maps
  `BLOB → VARBINARY(MAX)`, `UUID → UNIQUEIDENTIFIER`; `packages/dialect-mysql/src/MySqlTypeMapper.ts:27-31`
  maps `BLOB → BLOB`, `JSON|JSONB → JSON`.
- Today a snapshot column typed `BLOB` emits `BLOB` on all three dialects (verified in
  `ddl-convergence.golden.test.ts`), where `EnsureCreated` for the same model emits `BYTEA` /
  `VARBINARY(MAX)` / `BLOB`. `UUID` likewise emits `UUID` on SQL Server instead of `UNIQUEIDENTIFIER`.

## Why this is bad

- Migrations and `EnsureCreated` produce **different physical types** from the same model for four
  logical types — the same class of divergence `dialect-postgres/task-7` and `task-10` set out to
  remove, just narrowed rather than eliminated.
- Adding a logical type to a dialect mapper has no effect in migrations, and no compile error or
  test links the two lists. The gap can only widen.
- `BLOB` on PostgreSQL is not a real type: the emitted DDL fails at apply time if the column is
  ever created through migrations rather than `EnsureCreated`.

## Target architecture

Make "unrecognized" expressible in the shared contract instead of re-derived by the caller:

- Add `tryMapType(logicalType, length?): string | undefined` to `TypeMapper` (or expose a
  `knownTypes` set), leaving the *unknown-type policy* to each caller. The dialects keep their
  fallback in `mapType`; migrations calls `tryMapType` and passes through on `undefined`.
- `SnapshotTypeMapper` then holds no vocabulary of its own — it becomes a two-line policy decorator
  and the two lists cannot drift.

Then decide, deliberately, what to do with the four types that change: `BLOB`/`UUID`/`JSON`/`JSONB`
becoming their real physical types is a **fix**, but it is an output change for every existing
migration that uses them, so it needs its own reconciliation note and a golden update.

## Proposed refactor

1. Extend `TypeMapper` in `@ts-linq/types` (`minor`) with the "unknown" signal; implement it in the
   three mappers (each already has the recognized set as a `Record`/`switch`).
2. Rewrite `SnapshotTypeMapper` to delegate on `tryMapType` and pass through only on `undefined`.
3. Update the golden; document each changed type in the PR.
4. Consider a type-level or unit test asserting migrations and `EnsureCreated` agree on the physical
   type for every logical type — that is the invariant this task restores.

## Testing plan

- **Parity test:** for every logical type, `SnapshotTypeMapper.mapType(t)` equals the dialect
  mapper's `mapType(t)`; for a hand-written physical type it equals the input uppercased.
- **Regression:** golden diff limited to `BLOB`/`UUID`/`JSON`/`JSONB` columns.
- **Integration:** apply a migration with a `BLOB` and a `UUID` column on all three containers —
  currently this fails on PostgreSQL.

## Acceptance criteria

- [ ] `SnapshotTypeMapper` holds no hard-coded type list.
- [ ] Migrations and `EnsureCreated` map every logical type to the same physical type.
- [ ] Golden updated; each changed type documented.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`,
      `arch:*` pass.

## Notes

`dialect-postgres/task-10` chose passthrough deliberately to keep that PR byte-identical; the
narrowing is recorded in its README section and in the `SnapshotTypeMapper` docblock. This task is
the follow-through, and the `BLOB`-on-PostgreSQL case makes it more than cosmetic.
