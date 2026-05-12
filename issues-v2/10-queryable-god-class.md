# Issue #10 — God Class `Queryable<T>` (1567 строк)

**Severity:** Medium  
**Status:** Остаётся (перемещён в `@ts-linq/query`, строк стало больше)  
**Affected files:**
- `packages/query/src/Queryable.ts`

---

## Описание проблемы

Несмотря на package split, `Queryable<T>` по-прежнему объединяет 15+ ответственностей в одном классе:

| Зона ответственности | Строки |
|---|---|
| Query building (where, orderBy, skip, take, groupBy) | 233–470 |
| Execution & materialization | 897–938 |
| L2 entity cache (shouldUseL2Cache, tryGetFromCache, rememberInCache) | 1236–1335 |
| Fallback resilience (executeAndMaterialize, hedged race, throttle) | 897–1154 |
| Aggregate operations (sum, avg, min, max, contains) | 1375–1467 |
| Set operations (except, intersect, concat) | 1469–1525 |
| JOIN building (addJoin, parseJoinPredicate) | 1527–1566 |
| Count cache (buildCountCacheKey, executeCountQuery) | 727–753 |
| Property extraction from lambda strings | 1157–1215 |

### Queryable теперь дублирует RowMaterializer

```ts
// packages/query/src/Queryable.ts:1221-1301 — materializeEntity(), mapRowToEntity()
// packages/query/src/RowMaterializer.ts — та же логика
```

Две независимые реализации материализации. При исправлении бага нужно помнить обновить обе.

## Предлагаемое решение

Декомпозиция по единой ответственности:

```
Queryable<T>              → координатор, ~200 строк
QueryExecutor<T>          → executeAndMaterialize, hedging, fallback
AggregateQueryBuilder<T>  → sum, avg, min, max, contains
SetOperations<T>          → except, intersect, concat
PropertyExtractor         → extractPropertyFromKeySelector (статические хелперы)
```

`RowMaterializer` уже существует — нужно удалить дублирующий код из `Queryable`.
