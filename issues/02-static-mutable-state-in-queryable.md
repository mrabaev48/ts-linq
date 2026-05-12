# Issue #02 — Статические мутируемые поля в Queryable: разделяемое состояние на уровне процесса

**Severity:** Critical  
**Category:** Architecture / Concurrency / Multi-tenancy  
**Affected files:**
- `packages/core/src/query/Queryable.ts`
- `packages/core/src/query/QueryBuilder.ts`

---

## Описание проблемы

Класс `Queryable<T>` содержит **15 статических мутируемых полей**, которые разделяются между всеми экземплярами в рамках всего процесса Node.js:

```ts
export class Queryable<T> {
  // --- Process-global shared mutable state ---
  private static _countCache: Map<string, { value: number; ts: number }> = new Map();
  private static readonly _COUNT_CACHE_MAX = 2000;
  private static _inflightCounts: Map<string, Promise<number>> = new Map();
  private static _predicateSqlCache: Map<string, WhereClause> = new Map();
  private static _selectorPropsCache: Map<string, string[]> = new Map();
  private static _keySelectorCache: Map<string, string> = new Map();
  private static _includePropCache: Map<string, string> = new Map();
  // Fallback throttle state — shared across ALL contexts:
  private static _fallbackWindowStart: number = 0;
  private static _fallbackUsedInWindow: number = 0;
  private static _fallbackLastAttemptAt: number = 0;
}
```

Аналогично, `QueryBuilder` имеет статический кэш:

```ts
export class QueryBuilder {
  private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();
}
```

---

## Технические сложности

### 1. Кэши пересекаются между разными провайдерами

Предположим, приложение одновременно обращается к PostgreSQL (для записи) и MySQL (для чтения). Кэш `_predicateSqlCache` хранит SQL-условие `WHERE age > ?` как строку, но PostgreSQL использует именованные параметры (`$1`), а MySQL — позиционные (`?`). Поскольку кэш является статическим и не разделён по провайдеру, первый результат для данного предиката перезаписывает другой.

```ts
// Кэш-ключ = predicate.toString() = "u => u.age > 18"
// Первый запрос от PostgreSQL: сохраняет "age > $1"
// Второй запрос от MySQL: ВОЗВРАЩАЕТ "age > $1" — НЕВЕРНО
```

### 2. Fallback throttle является глобальным

Параметры троттлинга fallback-ов (`_fallbackWindowStart`, `_fallbackUsedInWindow`, `_fallbackLastAttemptAt`) разделяются между всеми `DbContext`-ами и всеми сущностями. Это означает:

- Если `ProductDbContext` исчерпал лимит fallback-ов (`maxPerMinute`), то и `UserDbContext` тоже не получит fallback.
- В тестах нет способа сбросить это состояние без хака через `(Queryable as any)._fallbackWindowStart = 0`.

### 3. CountCache имеет гонку данных в async-контексте

```ts
private static _inflightCounts: Map<string, Promise<number>> = new Map();

// В count():
const inflight = Queryable._inflightCounts.get(key);
if (inflight) return inflight;

const pending = this.executeCountQuery(metadata.tableName);
Queryable._inflightCounts.set(key, pending);
```

Это single-flight паттерн, но он применяется на уровне процесса: два разных `DbContext` с разными подключениями к БД будут разделять одну pending-запись в `_inflightCounts`. Если первый запрос падает по ошибке подключения, второй также получит эту ошибку — хотя его подключение было бы живым.

### 4. `_predicateSqlCache` разделяет кэш между разными схемами

Если два контекста имеют одноимённые сущности с разными схемами (multi-tenant, A/B-тестирование), кэш предикатов будет перемешивать SQL-условия:

```ts
// Tenant A: User.isActive -> таблица с BOOLEAN
// Tenant B: User.is_active -> таблица с TINYINT(1)
// Кэш-ключ: "u => u.isActive === true"
// Результат: возможно запишет неверный column name для одного из тенантов
```

### 5. Параллельные тесты падают непредсказуемо

Jest запускает тестовые файлы параллельно в разных воркерах. Но внутри одного воркера тесты — последовательные, и они накапливают артефакты в статических полях `Queryable`. Тест, который вызывает `Queryable.clearCountCache()`, влияет на все другие тесты в том же воркере.

---

## Предлагаемое решение

### Шаг 1: Убрать статические кэши, передавать их через DI

```ts
export interface QueryableOptions {
  countCache?: CountCacheStore;
  predicateSqlCache?: PredicateCacheStore;
  selectorCache?: SelectorCacheStore;
  fallbackThrottle?: FallbackThrottleState;
}

export class Queryable<T> {
  // Все кэши — инстанциевые, переданные снаружи
  private readonly _countCache: CountCacheStore;
  private readonly _predicateSqlCache: PredicateCacheStore;
  ...
}
```

### Шаг 2: Кэши создаются и владеются DbContext

```ts
export abstract class DbContext {
  private readonly _sharedCaches: SharedQueryCaches;

  constructor(options: DbContextOptions) {
    this._sharedCaches = {
      countCache: new InMemoryCountCache(options.performance?.countCacheTtlMs),
      predicateCache: new InMemoryPredicateCache(),
      fallbackThrottle: new FallbackThrottleState()
    };
  }
}
```

### Шаг 3: `Queryable` получает кэши через конструктор DbSet

```ts
// DbContext → DbSet → Queryable
const queryable = new Queryable(
  entityClass,
  provider,
  entityLoader,
  this._sharedCaches
);
```

### Шаг 4: Статические утилиты остаются статическими, только чистые функции

```ts
// ОК: чистая функция без состояния
static buildCountCacheKey(tableName: string, whereSignature: string): string { ... }

// НЕ ОК: мутируемое статическое состояние
private static _countCache: Map<...> = new Map(); // → убрать
```

---

## Дополнительно: `QueryBuilder._defaultCache` — та же проблема

```ts
export class QueryBuilder {
  private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();
  // Этот кэш разделяется между ВСЕМИ QueryBuilder-ами
}
```

`EnhancedSqlCache` также имеет `setInterval` таймер очистки. При создании нескольких `QueryBuilder`-ов создаётся несколько таймеров, но они все обращаются к одному статическому кэшу. Это race condition в Node.js event loop.

**Решение:** `QueryBuilder` должен принимать экземпляр кэша через конструктор (уже есть параметр `cache?`) и всегда использовать его — убрать `_defaultCache` как статик.
