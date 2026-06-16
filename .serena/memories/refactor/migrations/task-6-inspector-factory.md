# refactor migrations/task-6: centralize dialect-inspector selection

✅ DONE migrations' 6TH task (P1/S/low-risk). Branch `audit-refactor/migrations-inspector-factory`.

## What changed
- New `SchemaInspector` interface in `packages/migrations/src/SchemaInspector.ts`
  (`listTables(): Promise<string[]>`, `getIndexes(table): Promise<TableIndexDef[]>`). The three
  existing inspectors (`Postgres`/`MySql`/`Mssql`SchemaInspector) now `implements SchemaInspector`
  (signatures unchanged → back-compat).
- New `SchemaInspectorFactory.for(label, provider): SchemaInspector` — the SINGLE dialect →
  inspector selection point (Factory + ISP + DIP). `switch` on label: postgresql/mysql/mssql →
  matching inspector; default → `throw new UnsupportedOperationError(...)` with
  `details: { operation: 'SchemaInspectorFactory.for', providerLabel }`.
- Both duplicated dispatch chains replaced:
  - `SchemaSnapshot.buildActualFromProvider` — inner `idxFetch` now calls one factory-resolved
    `inspector.getIndexes(table)`.
  - `services/SchemaInspectionService.buildActualSnapshot` — both chains (listTables + fetchIndexes)
    collapse to one `inspector`; `existingTables = new Set(await inspector.listTables())`.
  - No `if (label === …)` inspector dispatch remains outside the factory.

## Unknown-dialect policy (unified)
Previously DIVERGENT: `SchemaSnapshot` → empty indexes (`[]`); `SchemaInspectionService` →
assume all expected tables exist. Now BOTH throw typed `UnsupportedOperationError`
(`@ts-linq/types`, code `UNSUPPORTED_OPERATION`). No `UnsupportedDialectError` exists in repo.

## Key correctness notes
- mysql idxFetch now emits `where: undefined` (was: key absent). Equivalent: `isIndexEqual`
  (`comparators/IndexComparator.ts`) compares `(where || '')`; JSON.stringify drops undefined →
  serialized snapshots byte-identical. Supported-dialect behaviour unchanged.
- Throwing-on-unknown is test-safe: no test runs the real dispatch with an unsupported label.
  `cli/tests/schema-apply-destructive.test.ts` mocks `buildActualFromProvider` wholesale (label
  postgresql); `StubDatabaseProvider` (label 'stub') is only used by `dbcontext:optimize`, never
  schema apply/diff/validate.

## Scope / API surface
- `SchemaInspector.ts` is NOT barrel-exported (`migrations/src/index.ts` only `export *` of
  `SchemaSnapshot`); factory+interface stay internal → changeset **patch** (migrations 2.8.1;
  orm/cli dependent patch).

## Tests
- New `packages/migrations/tests-new/SchemaInspectorFactory.test.ts` (8 tests): instanceof per
  supported label; unsupported labels (sqlite/stub/oracle/'') throw `UnsupportedOperationError`;
  asserts `instanceof OrmError`, `code === OrmErrorCode.UnsupportedOperation`, details payload.

## Validation
typecheck ✅, lint ✅ (0 errors), build ✅, root unit 3582/3582 ✅, migrations unit 338 ✅,
arch:deps/cycles/dead ✅. Integration/e2e deferred to manual run (project norm; feedback_test_runs).

## Follow-up (tech debt)
- Index introspection arguably belongs in the dialect packages (which own dialect SQL for the
  query path) rather than re-implemented in migrations. Recorded, not expanded.

next migrations = task-7 (clean up MigrationHandlers grab-bag + structural casts). migrations
package now task-1..6 ✅; remains 🔄 In Progress.
