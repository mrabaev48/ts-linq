# refactor/migrations/task-7 — MigrationHandlers cleanup (FINAL migrations task)

✅ DONE — migrations' 7TH/FINAL task. Branch `audit-refactor/migrations-cleanup-handlers`.

## What changed
- **`builders/MigrationHandlers.ts` DELETED** (was 359 LOC hybrid: re-export hub + live logic
  + dead `// moved to …` comments). Full pure-barrel decision (user-confirmed: aggressive).
  Its live logic relocated to the matching `handlers/*` files; nothing left to re-export, so
  the file is gone rather than left as a thin shim (avoids redundant re-export layer).
- **Logic relocation:**
  - index logic (`handleIndexCreates`, `buildCreateIndexSql`, `buildIndexColumnsList`,
    `buildIndexWhere/Using/Concurrently/WithParams/Visibility/Include`) → `handlers/IndexHandlers.ts`
  - column-change orchestration (`handleColumnChanges` + `handleAdd/Alter/DropColumnChange`)
    and predicates (`isComputedColumn`, `hasDefaultExpression`, `isComputedChanged`,
    `hasTypeChanged`) → `handlers/ColumnHandlers.ts` (added `norm` + `ColumnChange` imports)
  - `handleFkCreates` → `handlers/ForeignKeyHandlers.ts`
  - unique-constraint SQL (`buildAddUniqueConstraintSql`, `buildDropUniqueConstraintSql`,
    `handleUniqueConstraintCreates/Drops`) consolidated into `builders/UniqueConstraintsSqlBuilder.ts`
    (module-level exports; the class methods call them).
- **Imports repointed:** the 4 `*SqlBuilder`s (`Tables/Columns/ForeignKeys/Indexes`) now import
  from `./handlers/*` directly; `index.ts` re-exports `buildCreateIndexSql` from
  `handlers/IndexHandlers` and `buildAdd/DropUniqueConstraintSql` from `UniqueConstraintsSqlBuilder`.
  All previously-public names stay importable (barrel surface unchanged).

## Type-first / casts
- **No `ColumnDef` change** — the fields the casts reached (`isComputed`, `computedExpression`,
  `computedStorage`, `defaultExpression`, `comment`) were ALREADY first-class on `ColumnDef`
  (`DiffTypes.ts`). So the structural casts (`(c as { isComputed?: boolean })…`, the `:251`
  nullable cast, and the `ch as { kind: … }` narrowing) were pure noise → replaced with direct
  access; column-change handlers now take `ColumnChange` directly.
- **Quoter bypass was already closed** — unique-constraint SQL already used `q()` →
  `QuoterFactory.for(dialect)` (task-1). Task description's raw `` `${tableName}` ``/`[${tableName}]`
  was stale; this task only *consolidated* the home, output byte-identical.

## Out-of-scope tech debt (documented in migrations/README task-7 follow-ups)
Remaining `as { … }` casts read loosely-typed *actual-snapshot* introspection shapes:
`handlers/ColumnHandlers.ts:51` (`defaultExpressionDialect`), `SchemaSnapshot.ts:127-131,240`,
`comparators/IndexComparator.ts`, `comparators/ColumnComparator.ts`. Left untouched (not in
task evidence). Candidate follow-up: type the actual-snapshot interface / promote
`defaultExpressionDialect` onto `ColumnDef`.

## Tests added
- `tests-new/DiffTypes.type.test.ts` — type-level guard (Required<Pick<ColumnDef,…>> + @ts-expect-error)
- `tests-new/builders/UniqueConstraintsSqlBuilder.test.ts` — non-adversarial (byte-identical
  golden SQL ×3 dialects) + adversarial escaping + class-delegation + barrel-contract.

## Changeset / validation
- **patch** `@ts-linq/migrations` — purely internal cleanup (no ColumnDef field added, no public
  name change, SQL output byte-identical).
- All green: typecheck, lint (0 err), unit 3588, integration 461 (+2 skip), e2e 290, build,
  arch:deps/cycles/dead.

## **migrations package FULLY COMPLETE (tasks 1–7). Next package = telemetry (step 11).**
