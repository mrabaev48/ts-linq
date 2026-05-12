# Issue #14 — `keysetPaginate()` Хардкодит `?` Placeholder

**Severity:** Medium  
**Status:** Остаётся  
**Affected files:**
- `packages/query/src/Queryable.ts` (метод `keysetPaginate`, строки 530–557)

---

## Описание проблемы

```ts
// packages/query/src/Queryable.ts:542-549
if (after !== null && after !== undefined) {
  const whereClause: WhereClause = {
    condition: `${String(key)} > ?`,   // ← хардкод ? И propertyName
    parameters: [after as unknown as SqlParameter]
  };
  queryModel.where = queryModel.where || [];
  queryModel.where.push(whereClause);
}
```

Две проблемы в одной строке:

1. **`?` placeholder** — работает только для SQLite и MySQL. PostgreSQL ожидает `$1`, MSSQL — `@p1`
2. **`String(key)` вместо columnName** — если `propertyName` = `createdAt` и `columnName` = `created_at`, SQL будет некорректным

## Последствие

```ts
// На PostgreSQL:
await ctx.orders.orderBy(o => o.id).keysetPaginate('id', lastId, 20);
// Генерирует: WHERE id > ?
// PostgreSQL выбрасывает: syntax error at or near "?"
// Ожидается: WHERE id > $1
```

## Предлагаемое решение

Использовать `WhereClause` с placeholder `?` на уровне `QueryModel` — диалект при генерации
итогового SQL должен перенумеровывать параметры:

```ts
if (after !== null && after !== undefined) {
  // Резолвить columnName через метаданные
  const meta = MetadataStorage.getEntity(this._entityClass);
  const colName = meta?.columns.find(c => c.propertyName === String(key))?.columnName ?? String(key);
  const quotedCol = this._provider.getDialect().quoteIdentifier(colName);
  
  queryModel.where = queryModel.where || [];
  queryModel.where.push({
    condition: `${quotedCol} > ?`,  // '?' нормализуется диалектом при генерации SQL
    parameters: [after as unknown as SqlParameter]
  });
}
```

Если `QueryBuilder` корректно заменяет `?` на диалект-специфичный placeholder при финальной
генерации SQL — этого достаточно. Если нет — нужно добавить замену в `QueryBuilder.generateFromModel()`.
