# Issue #12 — `EnhancedSqlCache` Background Timer Leak и Shared Static Cache

**Severity:** Medium  
**Category:** Resource Management / Memory  
**Affected files:**
- `packages/core/src/query/EnhancedSqlCache.ts`
- `packages/core/src/query/QueryBuilder.ts`

---

## Описание проблемы

`EnhancedSqlCache` создаёт background `setInterval` таймер для периодической очистки expired записей. Этот таймер:
1. Никогда не останавливается автоматически в production
2. Разделяется через статическое поле `QueryBuilder._defaultCache`
3. Не интегрирован с lifecycle `DbContext.dispose()`

```ts
export class EnhancedSqlCache implements SqlCache {
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: EnhancedSqlCacheOptions = {}) {
    const isTestEnv = typeof process !== 'undefined' &&
      (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test');

    this.options = {
      ...
      defaultTtl: isTestEnv ? 0 : (options.defaultTtl ?? 0),
      // В тестах TTL = 0 (отключён), в prod — по умолчанию 0 тоже, но таймер запускается
    };

    // Таймер создаётся для prod, но не для тестов (правильно)
    if (!isTestEnv && this.options.defaultTtl > 0) {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
      this.cleanupInterval.unref?.(); // ← unref предотвращает блокировку exit, но не убивает таймер
    }
  }
}
```

```ts
// QueryBuilder — статический кэш на уровне процесса
export class QueryBuilder {
  private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();
  // ↑ Создаётся один раз при загрузке модуля и живёт вечно
}
```

---

## Технические сложности

### 1. `unref()` не решает проблему утечки

`this.cleanupInterval.unref()` позволяет Node.js завершить процесс даже при наличии активного таймера. Но это не освобождает ресурсы — таймер продолжает срабатывать, пока процесс жив. В долгоживущих приложениях (серверы, микросервисы) это постоянный background overhead.

### 2. Множественные `QueryBuilder` создают независимые кэши, но `_defaultCache` один

```ts
// Первый QueryBuilder использует _defaultCache:
const qb1 = new QueryBuilder(dialect); // использует QueryBuilder._defaultCache

// Если передан кастомный кэш — используется он:
const customCache = new EnhancedSqlCache({ maxSize: 500 });
const qb2 = new QueryBuilder(dialect, logger, 'pg', customCache);
// Но qb1 и qb2 всё равно делят статический _defaultCache если qb1 без кастомного кэша
```

В serverless-среде (AWS Lambda, Vercel) каждый cold start может создавать новый модуль, но при warm starts один и тот же `_defaultCache` используется повторно. Это не всегда желательно.

### 3. `dispose()` не вызывается автоматически при `DbContext.dispose()`

```ts
// DbContext.dispose():
public async dispose(): Promise<void> {
  await this._provider.disconnect();
  this._memoryProfiler?.stop?.();
  // ← НЕТ очистки QueryBuilder cache
  // ← НЕТ остановки cleanupInterval
}
```

Пользователь, правильно вызывающий `await ctx.dispose()`, всё равно оставляет работающий таймер кэша.

### 4. `QueryBuilder.disposeCache()` существует, но пересоздаёт кэш немедленно

```ts
public static disposeCache(): void {
  QueryBuilder._defaultCache.dispose(); // останавливает таймер старого кэша
  QueryBuilder._defaultCache = new EnhancedSqlCache(); // ← сразу создаёт новый с таймером!
}
```

После вызова `disposeCache()` немедленно создаётся новый `EnhancedSqlCache` с новым таймером. Это не даёт возможности полностью отключить кэш.

### 5. Тест-детекция через `JEST_WORKER_ID` — хрупкая эвристика

```ts
const isTestEnv = typeof process !== 'undefined' &&
  (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test');
```

- Vitest не устанавливает `JEST_WORKER_ID`
- Некоторые Jest-конфигурации могут иметь `NODE_ENV=production`
- В Mocha / Jasmine / AVA — не работает

---

## Предлагаемое решение

### Шаг 1: Сделать `EnhancedSqlCache` без фоновых таймеров по умолчанию

```ts
export interface EnhancedSqlCacheOptions {
  maxSize?: number;
  defaultTtl?: number;
  enableLru?: boolean;
  enableMetrics?: boolean;
  // Новый параметр:
  cleanupIntervalMs?: number | false; // false = отключить таймер
}

constructor(options: EnhancedSqlCacheOptions = {}) {
  const cleanupInterval = options.cleanupIntervalMs;
  
  // Таймер только если явно настроен И TTL > 0
  if (cleanupInterval !== false && 
      cleanupInterval !== undefined && 
      cleanupInterval > 0 && 
      this.options.defaultTtl > 0) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);
    this.cleanupInterval.unref?.();
  }
}
```

### Шаг 2: `dispose()` обязателен в интерфейсе `SqlCache`

```ts
export interface SqlCache {
  get(key: string): SqlCacheEntry | undefined;
  set(key: string, entry: SqlCacheEntry): void;
  delete(key: string): boolean;
  clear(): void;
  size?(): number;
  dispose(): void; // ← добавить как обязательный
}
```

### Шаг 3: Интегрировать с `DbContext.dispose()`

```ts
// DbContext:
private _queryBuilder?: QueryBuilder;

public async dispose(): Promise<void> {
  await this._provider.disconnect();
  this._queryBuilder?.disposeCache(); // освобождает таймер
  this._memoryProfiler?.stop?.();
}
```

Но это работает только если `QueryBuilder` — экземпляр, а не статический кэш (см. Issue #02).

### Шаг 4: Убрать статический `_defaultCache`, передавать кэш через DI

```ts
export class QueryBuilder {
  // Убрать:
  // private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();

  constructor(
    dialect: SqlDialect,
    logger?: SqlLogger,
    providerName?: string,
    cache?: SqlCache,  // ← обязательный или с разумным default
    namespace?: string
  ) {
    // Если cache не передан — создаём без таймера (lazy, без TTL)
    this._cache = cache ?? new EnhancedSqlCache({ cleanupIntervalMs: false });
  }
}
```

### Шаг 5: Отдать управление lifetime кэша пользователю

```ts
// Пользователь создаёт кэш и управляет его lifecycle:
const sqlCache = new EnhancedSqlCache({
  maxSize: 5000,
  defaultTtl: 300_000,
  cleanupIntervalMs: 60_000
});

const ctx = new AppDbContext({
  connection: { ... },
  performance: { sqlCache }
});

// При завершении:
await ctx.dispose();
sqlCache.dispose(); // явный dispose
```
