# dialect-postgres / task-8 — dead exports, OptionsBuilder dedup, dialect→core/metadata coupling

Branch: `audit-refactor/dialect-dead-exports-coupling` (from `origin/main`). Status: **completed**.
P2 / M / package-boundary. Closes the original 9-task audit scope of `dialect-postgres`.

## 1. Dead `chunk*Batch` removed

`chunkPgBatch` / `chunkMysqlBatch` / `chunkMssqlBatch` had **zero importers** — verified by grep +
`arch:dead`. The real chunking path is `packages/orm/src/save-changes/batch-grouper.ts:81`, which
composes `calcChunkSize` / `chunkArray` from `@ts-linq/sql-visitor` with `dialect.parameterLimit`.
The dialect copies were a silent duplicate of that logic.

Removed the functions plus the now-unused `import { calcChunkSize, chunkArray }` from each
`batch-syntax.ts`. **Kept**: `PG_/MYSQL_/MSSQL_PARAM_LIMIT` (read by each dialect's
`readonly parameterLimit`) and `selectInsertableColumns`/`selectUpdatableColumns` (used by
`buildBatchInsert`/`buildBatchUpdate`). `index.ts` needed no edit — it re-exports with `export *`.

## 2. Shared `DialectOptionsBuilder`

New `packages/dialect-kit/src/options/DialectOptionsBuilder.ts` (exported from the barrel). The
three per-dialect classes became **one-line subclasses**:

```ts
export class PostgresOptionsBuilder extends DialectOptionsBuilder {}
```

Subclass, not `export { X as Y }` — preserves `new PostgresOptionsBuilder()`, `instanceof`, and a
distinct name in the emitted `.d.ts`. New tests: `dialect-kit/tests-new/DialectOptionsBuilder.test.ts`
plus one alias test per dialect package.

## 3. `formatValue` — already done by task-7

`packages/dialect-kit/src/params/format-value.ts` already existed and no dialect imported
`SqlHelper`, so item 3 of the task file needed no work. `SqlHelper.formatValue` still sits in
`@ts-linq/core` with **zero production call sites** (only its own test) — removing it stays
**task-11**. Deliberately not folded in (unrelated cleanup + separate `core` major).

## 4. `buildSelect` takes metadata (parameterize-from-above)

```ts
buildSelect<T>(
  entityClass: new () => T,
  options: QueryOptions,
  metadata: EntityMetadata | undefined
): SqlQueryResult;
```

Chosen shape (user decision) over `buildSelect(metadata, options)`: the required 3rd position makes
the break compile-visible, `| undefined` preserves the `rawSqlSource` path exactly (metadata is
never needed there), and `entityClass` stays for the `Entity metadata not found for X` diagnostic —
so it is not a dead parameter.

- `AbstractSqlDialect`: the abstract `getEntityMetadata` hook is **deleted**; the `!metadata` throw
  stays inside the non-`rawSqlSource` branch, so behaviour is byte-identical.
- All three concrete dialects: `getEntityMetadata` override + `MetadataStorage` import removed.

### Production callers — one was NOT in the task file's evidence

| Caller | Note |
|---|---|
| `packages/query/src/SqlCompiler.ts` (`SqlCompilerImpl.generateSql`) | **Missing from the task evidence.** The main query path. Now resolves `MetadataStorage.getEntity(entityClass)` and forwards it. `@ts-linq/query` already depended on `@ts-linq/metadata` and already used this call in ~8 other files, so the pattern is consistent. `CachingSqlCompiler` unaffected (resolution is inside the cached core). |
| 3 providers × 4 sites | Each already held the metadata in a local (`meta` in PG, `metadata` in MySQL/MSSQL) — pure signature change. |
| `packages/testkits/src/dialect-contract/cases.ts` | Passes the new `contractSelectMeta` fixture. |

**Gotcha:** `MetadataStorage.getEntity` has a **reflect fallback** (metadata/task-4) that synthesizes
metadata for *unregistered* classes — it does not return `undefined`. A QueryBuilder test asserting
`undefined` failed because of this; the assertion became
`expect.objectContaining({ tableName: 'TestEntity' })`.

## 5. dialect→core edge actually removed (not just documented)

The introspectors only ever called `provider.executeQuery`, so a narrow port was extracted:

```ts
// packages/types/src/scaffolding.ts (next to DbIntrospector; depends on ./sql for SqlParameter)
export interface SqlQueryExecutor {
  executeQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
}
```

`DatabaseProvider.executeQuery<T>(sql, params = [])` satisfies it structurally → providers unchanged.

Consequences: `@ts-linq/core` **and** `@ts-linq/metadata` removed from `dependencies` of all three
dialect `package.json`s **and** from their `tsconfig.json` `references`. New dependency-cruiser rule
`no-dialect-to-core` (severity **error**, `^packages/dialect-` → `^packages/(core|metadata)(/|$)`)
makes the boundary permanent — `arch:deps` now genuinely proves it, which it could not before (only
`no-dialect-to-runtime` existed, and it does not cover `core`).

## Coupling reduction demonstrated by the tests

- `dialect-{postgres,mysql,mssql}/tests-new/dialect/*Dialect.test.ts`: dropped the global
  `MetadataStorage` `beforeEach`/`afterEach` entirely; each file now has a module-level
  `const testMeta: EntityMetadata`. The unknown-entity case passes `undefined` explicitly.
- `testkits` contract harness: `registerContractEntity`/`clearContractEntity` **deleted**, replaced
  by the `contractSelectMeta` fixture — the matrix is now a pure function of its inputs.
- Introspector fakes lost `connect`/`disconnect` and the `as unknown as DatabaseProvider` cast.

Tests keeping their registry setup (provider property/snapshot, integration, e2e temporal) resolve
metadata at the call site — the same shape as production `SqlCompilerImpl`.

## Validation

`typecheck` ✅ · `lint` ✅ 0 errors · `test:unit` 4201 ✅ · `test:integration` 461 ✅ ·
`test:e2e` 290 ✅ · `build` ✅ · `arch:deps` ✅ (incl. the new rule) · `arch:cycles` ✅ ·
`arch:dead` ✅ · `arch:phantom` ✅.

**Contract golden files are byte-identical — no SQL changed by any step.** A golden diff here would
be a regression, not an expected outcome.

Two flaky-in-parallel suites (`transformer/LiteralVisitor`, `integration alternate-keys-indexes`)
passed in isolation and on rerun — unrelated to this change.

## Versions (after `changeset version`)

`types` 4.11.0→**5.0.0** · `dialect-kit` 0.4.1→**1.0.0** · `dialect-{postgres,mysql,mssql}`
2.9.0→**3.0.0** · `testkits` 7.0.33→**8.0.0** (removed exports) · `query` 4.2.7 ·
`provider-*` 3.0.34 (patch).

## Package status — NOT closed

`dialect-postgres` stays **🔄 In Progress** in both READMEs (explicit user decision): task-1..9 ✅ but
**task-10** (converge migrations DDL), **task-11** (remove core `SqlHelper.formatValue`) and
**task-12** (inject DDL quoter) are still open tech debt from task-7. `dialect-mysql` (step 14) was
**not** advanced.
