# Issue #16 — `except()`, `intersect()`, `concat()` Monkey-Patch `toArray()`

**Severity:** Medium  
**Status:** Остаётся  
**Affected files:**
- `packages/query/src/Queryable.ts` (методы `except`, `intersect`, `concat`, строки 1469–1525)

---

## Описание проблемы

```ts
// packages/query/src/Queryable.ts:1470-1487
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  const boundOriginal = cloned.toArray.bind(cloned);
  
  // Monkey-patch: перезаписываем метод на экземпляре
  cloned.toArray = async function (this: Queryable<T>): Promise<T[]> {
    const thisResults = await boundOriginal();
    const otherResults = await other.toArray();
    const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
    return thisResults.filter((item) => !otherSet.has(JSON.stringify(item)));
  }.bind(cloned);
  
  return cloned;
}
```

## Последствия

### 1. `first()`, `count()`, `any()` игнорируют except()

```ts
const result = await ctx.users
  .except(bannedUsers)
  .first();  // first() вызывает executeAndMaterialize() напрямую, НЕ toArray()
             // → возвращает первого пользователя из ВСЕХ, игнорируя except()
```

### 2. `clone()` не копирует monkey-patched toArray

```ts
public clone(): Queryable<T> {
  const clonedQueryable = new Queryable<T>(...);
  clonedQueryable._model = this._model.clone();
  // ← НЕ копирует переопределённый toArray!
  return clonedQueryable;
}
```

### 3. JSON.stringify для сравнения нестабилен

- `Date` объекты сериализуются в строки → не совпадают с оригиналом
- `undefined` поля пропадают → ложные include/exclude

### 4. Загружает все строки в память

O(n+m) строк в память вместо одного SQL запроса:
```sql
-- Правильный SQL:
SELECT * FROM users EXCEPT SELECT * FROM banned_users
```

## Предлагаемое решение

Добавить `setOperation` в `QueryModel`:

```ts
// packages/query/src/QueryModel.ts
interface SetOperation {
  type: 'EXCEPT' | 'INTERSECT' | 'UNION' | 'UNION_ALL';
  other: QueryModel;
  entity: new () => unknown;
}

class QueryModel {
  setOperation?: SetOperation;
}
```

```ts
// packages/query/src/Queryable.ts
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  cloned._model.setOperation = {
    type: 'EXCEPT',
    other: other._model.clone(),
    entity: other._entityClass as unknown as new () => unknown
  };
  return cloned;
}
```

Тогда `first()`, `count()`, `any()` — все используют `QueryModel` — автоматически
получают поддержку `except()`. SQL генерируется правильно:

```sql
SELECT * FROM users EXCEPT SELECT * FROM banned_users
```

Для `concat()` уже существует `unionAll()` — `concat()` должен быть псевдонимом:

```ts
public concat(other: Queryable<T>): Queryable<T> {
  return this.unionAll(other);
}
```
