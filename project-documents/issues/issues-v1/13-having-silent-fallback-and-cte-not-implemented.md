# Issue #13 — `having()` Молчаливо Игнорирует Предикат; CTE — Half-Implemented Feature

**Severity:** Medium  
**Category:** Correctness / Incomplete Features  
**Affected files:**
- `packages/core/src/query/Queryable.ts` (методы `having`, `withCte`)

---

## Описание проблемы

### Проблема A: `having()` тихо подставляет `1=1` при ошибке парсинга

```ts
public having(predicate: (entity: T) => boolean): Queryable<T> {
  if (!this._model.groupBy) {
    throw new Error('having() requires a preceding groupBy()');
  }
  const parser = new PredicateParser<T>();
  const ast = parser.parse(predicate);
  if (ast) {
    const visitor = new SqlVisitor();
    const { condition, parameters } = visitor.toSql(ast);
    this._model.groupBy.having = { condition, parameters };
  } else {
    // ← ТИХИЙ FALLBACK:
    this._model.groupBy.having = { condition: '1=1', parameters: [] };
  }
  return this;
}
```

Когда `PredicateParser` не может разобрать предикат (например, `having(() => count > 5)`), метод не бросает исключение и не предупреждает. Вместо этого он генерирует `HAVING 1=1` — условие, которое **всегда истинно и полностью игнорирует намерение разработчика**.

### Проблема B: `withCte()` — "naive" реализация без настоящего WITH-clause

```ts
public withCte(name: string, subquery: Queryable<unknown>): Queryable<T> {
  const { query } = subquery._sqlBuilder.generateFromModel(
    subquery._entityClass as unknown as new () => unknown,
    subquery._model
  );
  const cloned = this.clone();
  // naive: store CTE name; real provider should prepend WITH clause at execution time
  cloned._model.from = name;  // ← просто меняет FROM на имя CTE
  cloned._cte = { name, sql: query };  // ← хранит CTE def, но не использует
  return cloned;
}
```

Комментарий в коде говорит всё: `// naive: store CTE name; real provider should prepend WITH clause at execution time`. Никакого `WITH name AS (...)` не генерируется. Сгенерированный SQL будет:

```sql
SELECT * FROM my_cte_name WHERE ...
-- Должно быть:
WITH my_cte_name AS (SELECT ...) SELECT * FROM my_cte_name WHERE ...
```

Запрос упадёт с ошибкой "table my_cte_name does not exist".

---

## Технические сложности

### A1: `having()` — HAVING на агрегатах не поддерживается

Наиболее распространённый use case `HAVING`:

```ts
ctx.orders
  .groupBy(o => o.customerId)
  .having(() => count() > 5)  // ← агрегатная функция!
  .toArray()
```

`PredicateParser` не умеет парсить вызовы функций вообще (они в `UNSUPPORTED_TOKENS`). Значит все реальные `HAVING`-условия с агрегатами (`COUNT`, `SUM`, `AVG`) будут заменены на `HAVING 1=1`.

Нет никакого способа передать `HAVING COUNT(*) > 5` через текущий API.

### A2: Молчаливый `1=1` ломает логику запроса без диагностики

```ts
ctx.orders
  .groupBy(o => o.status)
  .having(o => o.total > 1000)  // ← непарсируемо из-за переменной 'total'?
  // Фактически: HAVING 1=1 — возвращает ВСЕ группы без фильтрации
```

Разработчик ожидает отфильтрованный результат, получает полный. В тестах с малыми наборами данных это может не выявиться.

### B1: `_cte` поле на `QueryModel` через monkey-patch

```ts
// В executeAndMaterialize():
if (this._cte) {
  (model as unknown as { cte?: CteDefinition }).cte = this._cte;
  // ↑ Monkey-patch в объект QueryModel через unknown cast
}
```

CTE-информация прикрепляется к `QueryModel` через `as unknown as` cast — это не типизированное поле модели, а прикреплённый объект. `QueryBuilder` должен знать об этом extra-поле через тот же unsafe cast.

### B2: CTE не поддерживает рекурсию

Даже если бы `WITH` генерировался правильно, нет API для:
- `WITH RECURSIVE`
- множественных CTE: `WITH cte1 AS (...), cte2 AS (...)`
- ссылок между CTE

---

## Предлагаемое решение

### Фикс A: `having()` должен принимать raw SQL или бросать при ошибке парсинга

**Вариант 1:** Добавить `havingRaw()` для сложных агрегатных условий:

```ts
// Новый метод для агрегатных HAVING:
public havingRaw(condition: string, parameters: SqlParameter[] = []): Queryable<T> {
  if (!this._model.groupBy) {
    throw new Error('havingRaw() requires a preceding groupBy()');
  }
  this._model.groupBy.having = { condition, parameters };
  return this;
}

// Использование:
ctx.orders
  .groupBy(o => o.customerId)
  .havingRaw('COUNT(*) > ?', [5])
  .toArray()
```

**Вариант 2:** `having()` бросает при непарсируемом предикате (вместо `1=1`):

```ts
public having(predicate: (entity: T) => boolean): Queryable<T> {
  const ast = parser.parse(predicate);
  if (!ast) {
    throw new Error(
      `having(): predicate "${predicate.toString().slice(0, 80)}" cannot be translated to SQL. ` +
      'Use havingRaw() for aggregate conditions like COUNT(*) > 5.'
    );
  }
  ...
}
```

### Фикс B: Правильная генерация CTE

**Шаг 1:** Добавить CTE в `QueryModel` как типизированное поле:

```ts
export class QueryModel {
  ...
  public ctes?: Array<{ name: string; sql: string; parameters: SqlParameter[] }>;
}
```

**Шаг 2:** `QueryBuilder` генерирует `WITH` prefix:

```ts
public generateFromModel(entityClass, model: QueryModel): { query: string; parameters: SqlParameter[] } {
  let prefix = '';
  const prefixParams: SqlParameter[] = [];
  
  if (model.ctes && model.ctes.length > 0) {
    const cteParts = model.ctes.map(c => `${c.name} AS (${c.sql})`).join(', ');
    prefix = `WITH ${cteParts} `;
    for (const c of model.ctes) prefixParams.push(...(c.parameters || []));
  }
  
  const base = this.generateSql(entityClass, opts);
  return {
    query: prefix + base.query,
    parameters: [...prefixParams, ...base.parameters]
  };
}
```

**Шаг 3:** `withCte()` заполняет типизированное поле:

```ts
public withCte(name: string, subquery: Queryable<unknown>): Queryable<T> {
  const { query, parameters } = subquery._sqlBuilder.generateFromModel(
    subquery._entityClass as unknown as new () => unknown,
    subquery._model
  );
  const cloned = this.clone();
  cloned._model.ctes = [...(this._model.ctes || []), { name, sql: query, parameters }];
  cloned._model.from = name; // основная таблица — это CTE
  return cloned;
}
```
