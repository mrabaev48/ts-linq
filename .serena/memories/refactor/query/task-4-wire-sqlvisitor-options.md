# refactor query/task-4 — wire SqlVisitorOptions into .where()/.having() ✅ DONE

**Branch:** audit-refactor/query-wire-sqlvisitor-options. **First** query task done (order: 4,8,6,3,2,1,7,5,9,10).

## Problem fixed
3 bare `new SqlVisitor()` in query/src dropped ALL options → value converters silently ignored in
WHERE/HAVING (wrong results), spatial/hierarchy/JSON/EF predicates threw `UNSUPPORTED_*`.

## Design (Abstract Factory + DI)
- **New capability interface in `@ts-linq/sql-visitor`** (`src/DialectVisitorSupport.ts`):
  `DialectVisitorSupport.getVisitorTranslators(): DialectVisitorTranslators` (=Pick of SqlVisitorOptions:
  spatial/hierarchy/efFunction/jsonPath) + `hasVisitorSupport()` type guard. Exported from barrel.
  **Boundary reason:** SqlDialect lives in `@ts-linq/types` which cannot reference ef/json translators
  (those are sql-visitor types); spatial/hierarchy are in types. sql-visitor is the common dep of both
  dialects and query, so the capability lives there. **`@ts-linq/types`/`SqlDialect` untouched.**
- **Dialects implement it** (`implements SqlDialect, DialectVisitorSupport`): PostgresDialect (postgis+ltree+
  postgresEfFunctions+PostgresJsonPathTranslator), MysqlDialect (no hierarchy — omitted), MssqlDialect
  (mssqlHierarchyFunctions). Each holds a `private readonly jsonPathTranslator = new …JsonPathTranslator()`.
- **`@ts-linq/query/src/SqlVisitorFactory.ts`** (internal, NOT in public barrel → query patch):
  `create({metadata, dialect, converterResolver?, parameterStyle?})` → assembles SqlVisitorOptions:
  dialect translators via `hasVisitorSupport()`, converterResolver passed in, jsonAccessRewriter (from
  ownedEntities StorageStrategy.Json + jsonShape), complexAccessRewriter (from complexProperties).
  Default ParameterStyle.Question (preserve behavior — downstream renumbers `?`).
  Structured so query/task-3 can fold create() onto QueryContext mechanically.
- **Queryable**: added `buildConverterResolver()` (mirrors buildColumnResolver @ ~:1492; from
  metadata.columns[].converter), private `_visitorFactory`, private `createSqlVisitor()`. whereCompiled +
  havingCompiled use `createSqlVisitor()`. `applyGlobalFiltersToModel` passes the built visitor into apply().
- **GlobalFilterApplier.apply** now takes `visitor?: SqlVisitor` (8th arg) instead of `new SqlVisitor()`;
  named-filter block guarded by `&& visitor`. Updated its unit test to pass a visitor.

## Tests added
- `query/tests-new/SqlVisitorFactory.test.ts` — converter lifting active; jsonPath renders via capable
  dialect; plain dialect degrades (throws 'jsonPathTranslator'); raw literal when no resolver.
- `query/tests-new/converter-where.test.ts` — end-to-end whereCompiled().toArray(): `active===true`
  binds CONVERTED `1` (capturing provider).
- `integration-tests/tests-new/postgres/postgres.where-visitor-options.integration.test.ts` — DB-free,
  REAL PostgresDialect: spatial→ST_Distance, json→`->>'city'`, ef→LIKE compile (not throw).
- Updated sql-visitor `tests/index.test.ts` barrel snapshot (+`hasVisitorSupport`).

## Validation: ALL GREEN
typecheck 32/32, lint 0 errors, unit 3192, integration 461 (+88 suites), e2e 290, build 32/32,
arch deps/cycles/dead clean.

## Versions (changeset)
sql-visitor 4.2.0 (minor), dialect-postgres/mysql/mssql 2.7.0 (minor each), query 2.4.35 (patch).

## Tech debt / follow-ups
- `userFunctions` (ModelBuilder.hasDbFunction) NOT wired — live in @ts-linq/orm, unreachable from query;
  needs orm→provider/metadata plumbing.
- ParameterStyle stays Question for all dialects in this path (downstream renumbers) — not changed here.
- query/task-3: fold SqlVisitorFactory into QueryContext.
- query/task-6: when dialect-rendering moves, align translator getters.
- GlobalFilterApplier still has `catch {}` swallowing filter-compile errors (query/task-8 scope).
