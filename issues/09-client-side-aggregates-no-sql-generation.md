# Issue #09 — Агрегаты `sum`, `avg`, `min`, `max`, `all`, `contains` Загружают Все Строки в Память

**Severity:** High  
**Category:** Performance / Correctness  
**Affected files:**
- `packages/core/src/query/Queryable.ts` (методы: `average`, `sum`, `min`, `max`, `all`, `contains`, `except`, `intersect`)

---

## Описание проблемы

Все агрегирующие методы реализованы через загрузку всего результирующего набора в память Node.js и вычисление значений на стороне приложения, вместо генерации SQL-агрегатов (`SUM()`, `AVG()`, `MIN()`, `MAX()`).

```ts
public async average<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const entities = await this.toArray();  // ← ЗАГРУЖАЕТ ВСЕ СТРОКИ!
  if (entities.length === 0) throw new Error('Sequence contains no elements');
  const values = entities.map((e) => {
    const value = selector(e);
    return typeof value === 'number' ? value : Number(value) || 0;
  });
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

public async sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const entities = await this.toArray();  // ← ЗАГРУЖАЕТ ВСЕ СТРОКИ!
  const values = entities.map((e) => {
    const value = selector(e);
    return typeof value === 'number' ? value : Number(value) || 0;
  });
  return values.reduce((sum, val) => sum + val, 0);
}

public async min<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]> {
  const entities = await this.toArray();  // ← ЗАГРУЖАЕТ ВСЕ СТРОКИ!
  ...
}

public async max<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]> {
  const entities = await this.toArray();  // ← ЗАГРУЖАЕТ ВСЕ СТРОКИ!
  ...
}
```

---

## Технические сложности

### 1. Масштабирование: O(n) память и время

Вызов `sum(p => p.price)` на таблице с 10 миллионами записей:
1. Выполняет `SELECT * FROM products` — загружает 10M строк
2. Материализует 10M объектов в памяти Node.js
3. Запускает `.map()` и `.reduce()` на 10M объектов

Правильный SQL: `SELECT SUM(price) FROM products` — возвращает одну строку.

### 2. `any()` также неоптимален

```ts
public async any(): Promise<boolean> {
  const queryModel = this._model.clone();
  queryModel.limit = 1;  // ← хотя бы это ограничивает
  const entities = await this.executeAndMaterialize(queryModel);
  return entities.length > 0;
}
```

Здесь `LIMIT 1` установлен — это лучше, но всё равно материализует объект. Идеально: `SELECT EXISTS (SELECT 1 FROM ... WHERE ... LIMIT 1)`.

### 3. `all()` выполняет два запроса

```ts
public async all(predicate: (entity: T) => boolean): Promise<boolean> {
  const violatingElement = await this.where((entity) => !predicate(entity)).firstOrDefault();
  return violatingElement === null;
}
```

Здесь используется `!predicate(entity)` — отрицание предиката. Но `PredicateParser` не поддерживает отрицание (`!` в `UNSUPPORTED_TOKENS`). Значит весь результирующий набор загружается в память для фильтрации. И предикат здесь — лямбда, которая не будет переведена в SQL.

### 4. `contains()` через `JSON.stringify` — ненадёжно

```ts
public async contains(item: T): Promise<boolean> {
  const entities = await this.toArray(); // ← загружает всё
  const itemJson = JSON.stringify(item);
  return entities.some((entity) => JSON.stringify(entity) === itemJson);
  // JSON.stringify не стабилен для объектов с разным порядком ключей!
}
```

Если два объекта содержат одинаковые данные, но свойства были добавлены в разном порядке:
```ts
const a = { name: 'Alice', age: 30 };
const b = { age: 30, name: 'Alice' };
JSON.stringify(a) !== JSON.stringify(b); // false — хотя семантически равны
```

### 5. `except()` и `intersect()` — double full scan + O(n²) JSON

```ts
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  cloned.toArray = async function () {
    const thisResults = await boundOriginal();  // загружает ВСЕ из this
    const otherResults = await other.toArray(); // загружает ВСЕ из other
    const otherSet = new Set(otherResults.map((item) => JSON.stringify(item))); // O(n) памяти
    return thisResults.filter((item) => !otherSet.has(JSON.stringify(item))); // O(n) времени
  };
}
```

При этом monkey-patch `toArray` не работает для `first()`, `count()`, `any()`, которые минуют `toArray`.

---

## Предлагаемое решение

### Шаг 1: SQL-агрегаты через расширение QueryModel

```ts
// Новые поля в QueryModel:
export class QueryModel {
  ...
  public aggregate?: {
    function: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
    column: string;
    alias: string;
  };
}
```

### Шаг 2: Метод `aggregate()` в Queryable

```ts
// Внутренний метод
private async executeAggregate(
  fn: 'SUM' | 'AVG' | 'MIN' | 'MAX',
  columnName: string
): Promise<number> {
  const model = this._model.clone();
  this.applyGlobalFiltersToModel(model);
  model.aggregate = { function: fn, column: columnName, alias: 'result' };
  
  const { query, parameters } = this._sqlBuilder.generateFromModel(this._entityClass, model);
  // Генерирует: SELECT SUM(price) as result FROM products WHERE ...
  
  const rows = await this._provider.executeQuery<{ result: number }>(query, parameters);
  return rows[0]?.result ?? 0;
}
```

### Шаг 3: Рефакторинг публичных методов

```ts
public async sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  // Извлекаем имя свойства из лямбды (уже есть extractPropertyFromKeySelector)
  const propertyName = this.extractPropertyFromKeySelector(selector.toString());
  const columnName = this.resolveColumnName(propertyName);
  return this.executeAggregate('SUM', columnName);
}

public async average<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number> {
  const propertyName = this.extractPropertyFromKeySelector(selector.toString());
  const columnName = this.resolveColumnName(propertyName);
  return this.executeAggregate('AVG', columnName);
}
```

### Шаг 4: `except` и `intersect` — через SQL EXCEPT/INTERSECT или подзапросы

```ts
public except(other: Queryable<T>): Queryable<T> {
  // Вариант 1: SQL EXCEPT (если диалект поддерживает)
  const cloned = this.clone();
  cloned._model.setOperation = { type: 'EXCEPT', other: other._model.clone() };
  return cloned;
}
```

Или через `NOT IN` подзапрос:
```sql
SELECT * FROM users
WHERE id NOT IN (SELECT id FROM banned_users)
```

### Шаг 5: `contains()` через первичный ключ + IN-запрос

```ts
public async contains(item: T): Promise<boolean> {
  const metadata = MetadataStorage.getEntity(this._entityClass);
  if (metadata?.primaryKeys.length > 0) {
    const pk = metadata.primaryKeys[0] as keyof T;
    const pkValue = (item as Record<string, unknown>)[pk as string];
    if (pkValue != null) {
      return this.where(
        (e) => (e as Record<string, unknown>)[pk as string] === pkValue
      ).any();
    }
  }
  // Fallback только для объектов без PK
  const entities = await this.toArray();
  return entities.some((e) => this.deepEqual(e, item));
}
```

---

## Влияние на производительность

| Метод | Сейчас | После фикса |
|---|---|---|
| `sum()` на 1M строк | ~500MB RAM, 5с | ~1ms, 1 строка из БД |
| `average()` на 1M строк | ~500MB RAM, 5с | ~1ms |
| `min()`/`max()` на 1M строк | ~500MB RAM, 5с | ~1ms |
| `any()` с WHERE | LIMIT 1, хорошо | `SELECT EXISTS(...)` |
| `contains()` с PK | загружает всё | 1 запрос по PK |
| `except(1K vs 1K)` | 2K JSON.stringify | SQL EXCEPT |
