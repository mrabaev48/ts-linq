# Issue #17 — Полный Отказ от Runtime-парсинга Стрелочных Функций

**Severity:** High  
**Status:** Новый  
**Affected files:**
- `packages/query/src/Queryable.ts` (основной очаг — 11 методов + 3 хелпера + 5 regex + 3 кеша)

---

## Описание проблемы

Проект декларирует переход на compile-time трансформер (`@ts-linq/transformer`), но фактически только `where()` прошёл этот переход. **11 публичных методов** по-прежнему получают стрелочную функцию, вызывают `.toString()` и парсят результат регулярными выражениями в рантайме.

Это создаёт принципиальное противоречие в архитектуре: один метод требует трансформера и падает без него, остальные молча делают то, от чего проект официально отказался.

---

## Полный реестр мест с рантайм-парсингом

### Публичные методы (call sites)

| Метод | Строка | Хелпер | Аргумент |
|-------|--------|--------|----------|
| `select(selector)` | ~342 | `extractPropertiesFromSelector` | `(entity: T) => TResult` |
| `orderBy(keySelector)` | ~360 | `extractPropertyFromKeySelector` | `(entity: T) => TKey` |
| `orderByDescending(keySelector)` | ~376 | `extractPropertyFromKeySelector` | `(entity: T) => TKey` |
| `thenBy(keySelector)` | ~392 | `extractPropertyFromKeySelector` | `(entity: T) => TKey` |
| `thenByDescending(keySelector)` | ~409 | `extractPropertyFromKeySelector` | `(entity: T) => TKey` |
| `groupBy(selector)` | ~468 | `extractPropertiesFromSelector` | `(entity: T) => unknown` |
| `include(selector)` | ~575 | `REGEX_SINGLE_PROP` напрямую | `(entity: T) => unknown` |
| `sum(selector)` | ~1425 | `extractPropertyName` | `(entity: T) => T[K]` |
| `average(selector)` | ~1442 | `extractPropertyName` | `(entity: T) => T[K]` |
| `min(selector)` | ~1455 | `extractPropertyName` | `(entity: T) => T[K]` |
| `max(selector)` | ~1472 | `extractPropertyName` | `(entity: T) => T[K]` |

### Приватная инфраструктура парсинга (подлежит удалению целиком)

```ts
// packages/query/src/Queryable.ts — УДАЛИТЬ ВСЁ:

// Regex-константы (строки ~61-65)
private static readonly REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/;
private static readonly REGEX_OBJECT = /=>\s*\(\s*\{([^}]+)\}\s*\)/;
private static readonly REGEX_SIMPLE_OBJECT = /=>\s*\{([^}]+)\}/;
private static readonly REGEX_PROP_IN_OBJECT = /\w+:\s*\w+\.(\w+)/;
private static readonly REGEX_ANY_PROP = /(\w+)/;

// Кеши строк (строки ~67-69)
private static _selectorPropsCache: Map<string, string[]> = new Map();
private static _keySelectorCache: Map<string, string> = new Map();
private static _includePropCache: Map<string, string> = new Map();

// Методы-парсеры (~строки 747, 1214, 1247)
private extractPropertyName<K extends keyof T>(selector): string { ... }
private extractPropertiesFromSelector(selectorStr: string): string[] { ... }
private extractPropertyFromKeySelector(keySelectorStr: string): string { ... }
```

---

## Почему это проблема

### 1. Хрупкость при минификации / трансформации кода

`.toString()` на функции возвращает **исходный текст** функции так, как он был скомпилирован. После минификации `(entity) => entity.amount` превращается в `(e) => e.a`. Регекс `/=>\s*\w+\.(\w+)/` вернёт `"a"` вместо `"amount"` — запрос к неверной колонке, silent data corruption.

### 2. Парсинг ненадёжен по построению

Регекс `REGEX_SINGLE_PROP` покрывает только тривиальный случай `e => e.prop`. Уже `e => e.profile.city` его сломает. Добавление в `select()` `REGEX_OBJECT` и `REGEX_SIMPLE_OBJECT` — попытка закрыть дыры, которая добавляет ещё больше fragile edge cases.

### 3. Архитектурное противоречие

```ts
// where() — правильно: трансформер обязателен
public where(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error("ts-linq(where): compile-time transformer is required.");
}

// orderBy() — неправильно: молча парсит в рантайме
public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
  const keySelectorStr = keySelector.toString(); // ← рантайм парсинг
  const column = this.extractPropertyFromKeySelector(keySelectorStr);
  ...
}
```

Пользователь, видя что `where()` требует трансформер, разумно ожидает что `orderBy()`, `select()`, `sum()` и т.д. — тоже. На практике они работают без трансформера, но ненадёжно.

### 4. Дублирование (добавлено в Phase 4)

В PR #27 (fix/phase4-performance-correctness) был добавлен `extractPropertyName()` — дубликат уже существующего `extractPropertyFromKeySelector()`. Оба делают одно и то же. Это следствие отсутствия единой политики: новый код продолжает создавать парсеры вместо того, чтобы их удалять.

---

## Обязательное требование: полный переход на трансформер

**Парсинг стрелочных функций в рантайме больше не поддерживается.** Все методы, принимающие функцию-селектор, обязаны перейти на один из двух подходов:

### Вариант A — `keyof T` для простых key-селекторов

Методы, которые принимают только `e => e.prop` (одно свойство), переходят на `keyof T`:

```ts
// БЫЛО:
public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T>
public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T>
public thenBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T>
public thenByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T>
public groupBy(selector: (entity: T) => unknown): Queryable<T>
public include(selector: (entity: T) => unknown): Queryable<T>
public sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number>
public average<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number>
public min<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]>
public max<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]>

// СТАНЕТ:
public orderBy<K extends keyof T>(key: K): Queryable<T>
public orderByDescending<K extends keyof T>(key: K): Queryable<T>
public thenBy<K extends keyof T>(key: K): Queryable<T>
public thenByDescending<K extends keyof T>(key: K): Queryable<T>
public groupBy<K extends keyof T>(key: K): Queryable<T>
public include<K extends keyof T>(key: K): Queryable<T>
public sum<K extends keyof T>(key: K): Promise<number>
public average<K extends keyof T>(key: K): Promise<number>
public min<K extends keyof T>(key: K): Promise<T[K]>
public max<K extends keyof T>(key: K): Promise<T[K]>
```

Пример использования становится:
```ts
// БЫЛО:
await ctx.orders.orderBy(o => o.createdAt).sum(o => o.amount);
// СТАНЕТ:
await ctx.orders.orderBy('createdAt').sum('amount');
```

TypeScript статически проверяет, что `'createdAt'` и `'amount'` — реальные ключи сущности. Никакого парсинга.

### Вариант B — Трансформер (для `select` с произвольными проекциями)

`select(e => ({ id: e.id, name: e.name }))` не покрывается `keyof T`, потому что возвращает не ключ, а новый объект. Этот метод должен пройти тот же путь что `where()`:
- в рантайме — бросать с подсказкой про трансформер
- трансформер переписывает вызов в `selectCompiled({ fields: ['id', 'name'] })` на этапе компиляции

---

## Что нужно удалить

После миграции **весь следующий код удаляется без замены**:

```ts
// Удалить в packages/query/src/Queryable.ts:
private static readonly REGEX_SINGLE_PROP = ...;
private static readonly REGEX_OBJECT = ...;
private static readonly REGEX_SIMPLE_OBJECT = ...;
private static readonly REGEX_PROP_IN_OBJECT = ...;
private static readonly REGEX_ANY_PROP = ...;

private static _selectorPropsCache: Map<string, string[]>;
private static _keySelectorCache: Map<string, string>;
private static _includePropCache: Map<string, string>;

private extractPropertyName(...): string { ... }
private extractPropertiesFromSelector(...): string[] { ... }
private extractPropertyFromKeySelector(...): string { ... }
```

---

## Что нужно сделать с тестами

**Все тесты, которые передают стрелочную функцию в `orderBy`, `select`, `groupBy`, `include`, `sum`, `average`, `min`, `max`, подлежат обязательному обновлению** под новую `keyof T` сигнатуру.

Примеры обновления:

```ts
// Было (тесты с функцией-селектором):
queryable.orderBy(u => u.name)
queryable.sum(o => o.amount)
queryable.groupBy(p => p.category)
queryable.include(a => a.books)

// Станет (тесты с ключом):
queryable.orderBy('name')
queryable.sum('amount')
queryable.groupBy('category')
queryable.include('books')
```

Особое внимание:
- **`packages/query/tests-new/`** — все unit-тесты `Queryable`
- **`packages/integration-tests/`** — интеграционные тесты MySQL, PostgreSQL, MSSQL
- **`packages/orm/tests-new/`** — тесты DbSet/DbContext, которые используют Queryable API

Тесты, которые проверяли **поведение парсинга** (например, что `e => e.name` корректно парсится), удаляются. Вместо них нужны тесты, которые проверяют что:
1. TypeScript не компилирует `orderBy('nonExistentKey')` — это статическая гарантия
2. Сгенерированный SQL содержит правильное имя колонки через `columnName` из метаданных
