# Coercion fail-fast sweep — remaining silent String(value) copies (✅ follow-up to task-5)

Follow-up на [[refactor/dialect-postgres/task-5-typed-coercion-error]], та же ветка
`audit-refactor/dialect-typed-coercion-error` (стек поверх коммита `04e36e3d`).

## Что сделано
task-5 закрыл тихий fallback только в dialect-kit `coerceSqlParameter`. Тот же паттерн
`catch { return String(value) }` жил ещё в 5 копиях вне scope task-5 — все устранены in-place
(fail-fast `ParameterCoercionError` + `bigint→toString()` до JSON, как в task-5):

1. `@ts-linq/core` — `SqlHelper.ensureSqlParameter(value, property?)`; идентификатор `key` протянут
   из `buildWhereClause`.
2. `@ts-linq/query` — module-fn `coerceToSqlParameter(value, property?)` в `SetPropertyCalls`;
   `propertyName` протянут из `setProperty`.
3/4/5. `@ts-linq/provider-{postgres,mssql,mysql}` — private `coerceToSqlParameter(value, property?)`;
   `c.propertyName`/`pk`/`column`/`k` протянуты в column-map/by-id/by-conditions call-sites.

## Границы (важно)
НЕ консолидировали в dialect-kit: core/query/provider НЕ зависят от dialect-kit — импорт создал бы
новые рёбра + риск циклов (arch:deps/cycles подтвердили: новых рёбер нет). Провайдерные coerce вдобавок
имеют провайдер-специфичные префиксы (hierarchyId/geometry/undefined→null), целиком не заменяемы.
Правильная де-дупликация провайдерных copies остаётся **отдельным** refactor `provider-*/task-2`/`task-4`
(«extract shared mapper/coercer»). `ParameterCoercionError` импортируется из `@ts-linq/types` (все зависят).

## Вне scope (не трогали, легитимно)
`SqlHelper.formatValue` `return String(value)` — inline DEFAULT-форматирование (не catch);
`PostgresProvider.convertValueForPg` `JSON.stringify(value)` — JSON/JSONB-конверсия колонок (без catch).

## Тесты
core `SqlHelper.test.ts` (+circular throws/bigint/plain object); новый `query/tests-new/SetPropertyCalls.test.ts`.
Провайдерных unit-тестов для coerce нет (драйверы hard-required, только real-DB).

## Changeset
5× **patch**: core 3.4.8, query 4.2.2, provider-{postgres,mssql,mysql} 3.0.29. types/dialect-kit не трогали.

## Валидация (всё зелёное)
typecheck ✓ · lint ✓ · test:unit 3909 ✓ · integration 461 ✓ · e2e 290 ✓ · build ✓ · arch:deps/cycles/dead ✓.
grep: тихих `catch { return String(value) }` в репо больше нет.
