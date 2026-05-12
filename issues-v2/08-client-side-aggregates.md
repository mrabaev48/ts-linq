# Issue #08 — Клиентские Агрегаты Загружают Все Строки в Память

**Severity:** High  
**Status:** Остаётся (перемещён в `@ts-linq/query`)  
**Affected files:**
- `packages/query/src/Queryable.ts` (методы `sum`, `average`, `min`, `max`, `contains`)

---

## Описание проблемы

Методы агрегации реализованы как клиентская обработка: сначала загружаются ВСЕ строки,
затем вычисляется агрегат в JavaScript:

```ts
// packages/query/src/Queryable.ts:1399-1410
public async sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const entities = await this.toArray();  // ← загружает ВСЕ строки!
  const values = entities.map((e) => {
    const value = selector(e);
    return typeof value === 'number' ? value : Number(value) || 0;
  });
  return values.reduce((sum, val) => sum + val, 0);
}

public async average<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const entities = await this.toArray();  // ← загружает ВСЕ строки!
  ...
}
```

Аналогично: `min()`, `max()`, `contains()`.

## Масштаб проблемы

На таблице с 1 000 000 строк:

```ts
const totalRevenue = await ctx.orders.sum(o => o.amount);
// Загружает 1M объектов в Node.js heap → OOM или очень медленно
// SQL: SELECT * FROM orders
// Правильный SQL: SELECT SUM(amount) FROM orders
```

## Предлагаемое решение

Генерировать SQL агрегаты через `QueryBuilder`:

```ts
public async sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const column = this.extractPropertyFromKeySelector(selector.toString());
  const meta = MetadataStorage.getEntity(this._entityClass);
  const colName = meta?.columns.find(c => c.propertyName === column)?.columnName ?? column;
  
  const queryModel = this._model.clone();
  this.applyGlobalFiltersToModel(queryModel);
  const { query, parameters } = this._sqlBuilder.generateFromModel(this._entityClass, queryModel);
  
  // Оборачиваем в SUM подзапрос
  const aggSql = `SELECT COALESCE(SUM(${colName}), 0) as result FROM (${query}) as _agg`;
  const rows = await this._provider.executeQuery<{ result: number }>(aggSql, parameters);
  return rows[0]?.result ?? 0;
}
```

Или добавить в `QueryModel` поле `aggregate`:

```ts
interface QueryModel {
  aggregate?: { fn: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT'; column: string };
}
```

И генерировать `SELECT SUM(column) FROM table WHERE ...` напрямую в `QueryBuilder`.
