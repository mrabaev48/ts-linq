# Issue #14 — `keysetPaginate()` Хардкодит `?` Placeholder, Несовместимый с PostgreSQL и MSSQL

**Severity:** Medium  
**Category:** Multi-database Compatibility / Correctness  
**Affected files:**
- `packages/core/src/query/Queryable.ts` (метод `keysetPaginate`)

---

## Описание проблемы

Метод `keysetPaginate()` формирует SQL WHERE-условие напрямую, используя хардкоженный `?` placeholder:

```ts
public async keysetPaginate<TKey extends keyof T>(
  key: TKey,
  after: T[TKey] | null,
  size: number
): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
  ...
  if (after !== null && after !== undefined) {
    const whereClause: WhereClause = {
      condition: `${String(key)} > ?`,  // ← хардкод!
      parameters: [after as unknown as SqlParameter]
    };
    queryModel.where = queryModel.where || [];
    queryModel.where.push(whereClause);
  }
  ...
}
```

---

## Технические сложности

### 1. Разные базы данных используют разные placeholder-синтаксисы

| База данных | Placeholder | Пример |
|---|---|---|
| SQLite | `?` | `WHERE id > ?` |
| MySQL | `?` | `WHERE id > ?` |
| PostgreSQL | `$N` | `WHERE id > $1` |
| MS SQL Server | `@pN` | `WHERE id > @p1` |

Хардкод `?` ломает `keysetPaginate()` на PostgreSQL и MSSQL.

### 2. Параметр `key` — это `propertyName`, не `columnName`

```ts
condition: `${String(key)} > ?`
// key = 'id' → 'id > ?' — ОК если columnName === 'id'
// key = 'userId' → 'userId > ?' — НЕ ОК если columnName = 'user_id'
```

Проблема с именами столбцов — та же что в Issue #07, но здесь дополнительно усугублена хардкодом placeholder.

### 3. Нет квотирования имени столбца

```ts
condition: `${String(key)} > ?`
// Если key = 'order' → 'order > ?' — синтаксическая ошибка в SQL
// (ORDER — зарезервированное слово)
```

### 4. Параметры numbered placeholders смещаются

В PostgreSQL все параметры в запросе нумеруются глобально: `$1`, `$2`, `$3`, ... Если `keysetPaginate` добавляет WHERE с `$1`, а затем QueryBuilder добавляет ещё WHERE-условия — нумерация нарушится.

Диалект PostgreSQL должен назначать номера параметров после того, как все WHERE-условия собраны, а не при добавлении каждого отдельно.

---

## Предлагаемое решение

### Шаг 1: Использовать абстракцию placeholder через SqlDialect

```ts
// В интерфейсе SqlDialect:
export interface SqlDialect {
  ...
  getParameterPlaceholder(index: number): string; // '?' для SQLite/MySQL, '$N' для PG, '@pN' для MSSQL
  quoteIdentifier(name: string): string;           // "name" для PG, `name` для MySQL, [name] для MSSQL
}
```

```ts
// SQLiteDialect:
getParameterPlaceholder(index: number): string { return '?'; }
quoteIdentifier(name: string): string { return `"${name}"`; }

// PostgresDialect:
getParameterPlaceholder(index: number): string { return `$${index}`; }
quoteIdentifier(name: string): string { return `"${name}"`; }

// MsSqlDialect:
getParameterPlaceholder(index: number): string { return `@p${index}`; }
quoteIdentifier(name: string): string { return `[${name}]`; }
```

### Шаг 2: Рефакторинг `keysetPaginate()` — через QueryModel, не через raw SQL

Вместо самостоятельного формирования WHERE-условия — добавить это в `QueryModel` и делегировать диалекту:

```ts
public async keysetPaginate<TKey extends keyof T>(
  key: TKey,
  after: T[TKey] | null,
  size: number
): Promise<...> {
  if (size < 1) throw new Error('keysetPaginate requires size >= 1');
  
  const queryModel = this._model.clone();
  
  // Ensure ORDER BY
  queryModel.orderBy = queryModel.orderBy || [];
  if (!queryModel.orderBy.some(o => o.column === String(key))) {
    queryModel.orderBy.push({ column: String(key), direction: 'ASC' });
  }
  
  queryModel.limit = size;
  
  if (after !== null && after !== undefined) {
    // Использовать WhereClause с маркером для диалект-специфичного placeholder
    // Диалект сам назначит номер параметра при финальной генерации SQL
    queryModel.where = queryModel.where || [];
    queryModel.where.push({
      condition: `{col:${String(key)}} > {param}`,  // абстрактный формат
      parameters: [after as unknown as SqlParameter],
      // Или просто добавить keyOf маппинг:
      columnRef: String(key)  // диалект резолвит к columnName + placeholder
    });
  }
  
  this.applyGlobalFiltersToModel(queryModel);
  const items = await this.executeAndMaterialize(queryModel);
  ...
}
```

### Вариант: Typed KeysetCursor

Более clean API — выделить keyset pagination в отдельный метод с типизированным курсором:

```ts
export interface KeysetPage<T, TKey> {
  items: T[];
  pageSize: number;
  nextCursor: TKey | null;
  hasPreviousPage: boolean;
}

public async pageCursor<TKey extends keyof T>(
  options: {
    key: TKey;
    after?: T[TKey] | null;
    before?: T[TKey] | null;
    take: number;
    direction?: 'forward' | 'backward';
  }
): Promise<KeysetPage<T, T[TKey]>> { ... }
```

Это более выразительный API, совместимый с Relay Cursor Connections спецификацией.
