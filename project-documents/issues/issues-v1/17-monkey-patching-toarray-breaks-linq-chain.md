# Issue #17 — `except()`, `intersect()`, `concat()` Monkey-Patch `toArray()`: Нарушение Контракта Queryable

**Severity:** Medium  
**Category:** Correctness / API Contract  
**Affected files:**
- `packages/core/src/query/Queryable.ts` (методы `except`, `intersect`, `concat`)

---

## Описание проблемы

Методы `except()`, `intersect()`, `concat()` реализованы через **monkey-patching метода `toArray()`** на клонированном экземпляре `Queryable`:

```ts
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  const boundOriginal = cloned.toArray.bind(cloned);

  // ← Monkey-patch: заменяем метод на экземпляре!
  cloned.toArray = async function (this: Queryable<T>): Promise<T[]> {
    const thisResults = await boundOriginal();
    const otherResults = await other.toArray();
    const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
    return thisResults.filter((item) => !otherSet.has(JSON.stringify(item)));
  }.bind(cloned);

  return cloned;
}
```

---

## Технические сложности

### 1. `first()`, `count()`, `any()`, `paginate()` не используют `toArray()` внутри

Monkey-patch `toArray` не влияет на другие методы запроса, которые идут напрямую к `executeAndMaterialize()`:

```ts
// Метод first() в Queryable:
public async first(): Promise<T> {
  const queryModel = this._model.clone();
  queryModel.limit = 1;
  this.applyGlobalFiltersToModel(queryModel);
  const entities = await this.executeAndMaterialize(queryModel); // ← НЕ вызывает toArray!
  if (!entities.length) throw new Error('Sequence contains no elements');
  return entities[0];
}
```

Поэтому:

```ts
const result = await ctx.users
  .except(bannedUsers)
  .first(); // ← first() игнорирует except()! Вернёт первого из ВСЕХ users.

const count = await ctx.users
  .except(bannedUsers)
  .count(); // ← count() тоже игнорирует except()!

const exists = await ctx.users
  .except(bannedUsers)
  .any(); // ← any() игнорирует except()!
```

Это молчаливое неверное поведение — самый опасный тип баги.

### 2. Последующий `.where()` применяется ДО except(), не после

```ts
const query = ctx.users
  .except(bannedUsers)
  .where(u => u.age > 18);
```

Визуально читается как: "возьми всех users, исключи banned, потом отфильтруй по возрасту".

Фактически: `where()` добавляет условие в `QueryModel`, который используется при вызове `boundOriginal()`. То есть WHERE применяется к `thisResults` ДО исключения `bannedUsers`. Порядок не соответствует декларативному чтению.

### 3. `JSON.stringify` для сравнения — нестабильно и медленно

```ts
const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
return thisResults.filter((item) => !otherSet.has(JSON.stringify(item)));
```

Проблемы:
- `JSON.stringify` нестабилен для объектов с Date полями (превращает в строку)
- Не работает для объектов с `undefined` значениями (они пропадают из JSON)
- O(n) памяти для `otherSet`
- O(n²) операций `JSON.stringify`
- Не сравнивает по первичному ключу (даже если он есть)

### 4. Closure захватывает `other` — нет lazy evaluation

```ts
cloned.toArray = async function () {
  const otherResults = await other.toArray(); // other выполняется при каждом toArray()
};
```

Если `other` — дорогой запрос, он будет выполняться повторно при каждом вызове `toArray()` на цепочке.

### 5. `clone()` не копирует monkey-patched `toArray`

```ts
public clone(): Queryable<T> {
  const clonedQueryable = new Queryable<T>(...);
  clonedQueryable._model = this._model.clone();
  clonedQueryable._includes = [...this._includes];
  // ← НЕ копирует custom toArray!
  return clonedQueryable;
}
```

Если вызвать `.clone()` на результате `.except()`, клон будет без except-логики.

---

## Предлагаемое решение

### Вариант A: Добавить `setOperation` в `QueryModel` и поддержать через SQL

```ts
export class QueryModel {
  ...
  public setOperation?: {
    type: 'EXCEPT' | 'INTERSECT' | 'UNION' | 'UNION_ALL';
    other: QueryModel;
    entity: new () => unknown;
  };
}
```

```ts
// В Queryable:
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  cloned._model.setOperation = {
    type: 'EXCEPT',
    other: other._model.clone(),
    entity: other._entityClass as unknown as new () => unknown
  };
  return cloned;
}

// В QueryBuilder.generateFromModel():
if (model.setOperation) {
  const right = this.generateFromModel(model.setOperation.entity, model.setOperation.other);
  const keyword = model.setOperation.type.replace('_', ' ');
  return {
    query: `${base.query} ${keyword} ${right.query}`,
    parameters: [...base.parameters, ...right.parameters]
  };
}
```

Генерирует правильный SQL:
```sql
SELECT * FROM users WHERE age > 18
EXCEPT
SELECT * FROM banned_users
```

Работает для `first()`, `count()`, `any()` — все они используют `QueryModel`.

### Вариант B: Добавить pipeline операции в QueryModel

Для `concat()` (которого нет в EXCEPT/INTERSECT) — это уже частично реализовано через `union()` / `unionAll()`:

```ts
// concat() = UNION ALL
public concat(other: Queryable<T>): Queryable<T> {
  return this.unionAll(other); // ← уже существует и работает правильно!
}
```

### Вариант C: Явный fallback с предупреждением для провайдеров без поддержки

```ts
public except(other: Queryable<T>): Queryable<T> {
  // Проверяем, поддерживает ли диалект EXCEPT
  if (this._provider.getDialect().supportsExcept()) {
    // SQL path (Вариант A)
    return this.exceptViaSql(other);
  } else {
    // Клиентская фильтрация с предупреждением
    console.warn('[ts-linq] EXCEPT is not supported by this dialect. Falling back to client-side filtering. This loads all rows into memory.');
    return this.exceptClientSide(other);
  }
}
```

---

## Немедленный фикс без рефакторинга

Как минимум — задокументировать ограничение и бросить ошибку при цепочке с `first()`, `count()`, `any()`:

Нет простого способа это сделать без рефакторинга — именно поэтому Вариант A является правильным решением.
