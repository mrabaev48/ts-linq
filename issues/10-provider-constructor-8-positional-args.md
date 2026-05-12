# Issue #10 — Конструктор `DatabaseProvider` с 8 Позиционными Аргументами: Long Parameter List Anti-Pattern

**Severity:** Medium  
**Category:** API Design / Usability / DX  
**Affected files:**
- `packages/core/src/DatabaseProvider.ts`
- `packages/core/src/context/DbContext.ts` (DbContextOptions)
- `packages/postgres/src/` (PostgresProvider конструктор)
- `packages/mysql/src/` (MySqlProvider конструктор)
- `packages/mssql/src/` (MsSqlProvider конструктор)

---

## Описание проблемы

Абстрактный базовый класс `DatabaseProvider` принимает **8 позиционных параметров** в конструкторе:

```ts
constructor(
  connectionString: string,
  logger?: SqlLogger,
  middlewares?: OrmMiddleware[],
  softDelete?: SoftDeleteOptions,
  retryPolicy?: RetryPolicy,
  poolOptions?: ConnectionPoolOptions,
  healthCheck?: ConnectionHealthCheckOptions,
  circuitOptions?: CircuitBreakerOptions
)
```

При создании провайдера пользователь вынужден передавать `undefined` для всех опциональных параметров, которые он не использует:

```ts
const provider = new PostgresProvider(
  'postgresql://...',
  myLogger,           // logger
  undefined,          // middlewares — не нужен
  undefined,          // softDelete — не нужен
  retryPolicy,        // retryPolicy
  undefined,          // poolOptions — не нужен
  undefined,          // healthCheck — не нужен
  circuitOptions      // circuitOptions
);
```

---

## Технические сложности

### 1. Любое добавление параметра ломает все существующие вызовы

При добавлении нового параметра (например, `queryAnalysis`) — который уже есть в коде через другой механизм — все существующие конструкторы конкретных провайдеров (`PostgresProvider`, `MySqlProvider`, `MsSqlProvider`, `SQLiteProvider`) должны быть обновлены. Каждый из них передаёт все параметры в `super(...)`.

### 2. Конкретные провайдеры ещё больше усугубляют проблему

```ts
// Предположительно в packages/postgres/src/PostgresProvider.ts:
class PostgresProvider extends DatabaseProvider {
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy,
    poolOptions?: ConnectionPoolOptions,
    healthCheck?: ConnectionHealthCheckOptions,
    circuitOptions?: CircuitBreakerOptions
  ) {
    super(connectionString, logger, middlewares, softDelete, retryPolicy, poolOptions, healthCheck, circuitOptions);
  }
}
```

Это полный дубликат сигнатуры. При добавлении 9-го параметра — нужно менять все 4+ провайдера.

### 3. `DbContextOptions` правильно использует объект-конфиг, но `provider` нарушает это

```ts
export interface DbContextOptions {
  provider: DatabaseProvider; // ← пользователь сам создаёт провайдер!
  performance?: PerformanceOptions;
  loading?: LoadingDefaults;
  ...
}

// Пользователь вынужден писать:
const ctx = new AppDbContext({
  provider: new PostgresProvider(
    'postgresql://...',
    logger,
    undefined, // middlewares
    undefined, // softDelete
    retryPolicy,
    ...
  ),
  performance: { ... }
});
```

Это leaky abstraction: детали инициализации провайдера вытекают в код пользователя.

### 4. Нет способа отложить конфигурацию

EF Core предоставляет `DbContextOptionsBuilder`, который позволяет конфигурировать контекст через fluent API, в том числе в `Startup.cs` или через DI-контейнер. Здесь такой возможности нет.

### 5. Опциональный `DbContextOptions.provider: DatabaseProvider` не описывает в себе connection string

Текущий API странным образом передаёт уже инициализированный `DatabaseProvider` в `DbContextOptions`, хотя остальные опции (performance, loading, etc.) — это не-инициализированные конфигурации. Это инконсистентно:

- `performance` — объект конфигурации (не экземпляр класса)
- `loading` — объект конфигурации
- `provider` — **инициализированный экземпляр** провайдера

---

## Предлагаемое решение

### Вариант A: Options Object Pattern для `DatabaseProvider`

```ts
export interface DatabaseProviderOptions {
  connectionString: string;
  logger?: SqlLogger;
  middlewares?: OrmMiddleware[];
  softDelete?: SoftDeleteOptions;
  retryPolicy?: RetryPolicy;
  pool?: ConnectionPoolOptions;
  healthCheck?: ConnectionHealthCheckOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

export abstract class DatabaseProvider {
  constructor(options: DatabaseProviderOptions) {
    this.connectionString = options.connectionString;
    this.logger = options.logger;
    this.middlewares = options.middlewares;
    // ...
  }
}
```

Использование:
```ts
const provider = new PostgresProvider({
  connectionString: 'postgresql://...',
  logger: myLogger,
  retryPolicy: new ExponentialBackoffRetryPolicy(),
  circuitBreaker: { failureThreshold: 5, openDurationMs: 30000 }
  // pool и healthCheck — не указаны, не нужны
});
```

### Вариант B: Builder Pattern для DbContext (как EF Core `DbContextOptionsBuilder`)

```ts
export class DbContextOptionsBuilder {
  private _options: Partial<DbContextOptions> = {};

  usePostgres(connectionString: string): this {
    this._options.connectionString = connectionString;
    this._options.providerType = 'postgres';
    return this;
  }

  useLogger(logger: SqlLogger): this {
    this._options.logger = logger;
    return this;
  }

  withCircuitBreaker(options: CircuitBreakerOptions): this {
    this._options.circuitBreaker = options;
    return this;
  }

  enableSoftDelete(column?: string): this {
    this._options.softDelete = { enabled: true, column };
    return this;
  }

  build(): DbContextOptions { ... }
}

// Использование:
const options = new DbContextOptionsBuilder()
  .usePostgres(process.env.DATABASE_URL)
  .useLogger(pinoLogger)
  .withCircuitBreaker({ failureThreshold: 5 })
  .enableSoftDelete()
  .build();

const ctx = new AppDbContext(options);
```

### Вариант C: Минимальный фикс — объединить в `ProviderOptions`

Минимальный и быстрый: просто собрать все параметры в один объект, сохранив backward compatibility через deprecated-конструктор:

```ts
export abstract class DatabaseProvider {
  // Новый конструктор:
  constructor(options: DatabaseProviderOptions);
  // Deprecated legacy:
  /** @deprecated Use DatabaseProviderOptions object */
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    ...
  );
  constructor(
    optionsOrString: DatabaseProviderOptions | string,
    ...
  ) {
    if (typeof optionsOrString === 'string') {
      // legacy path
    } else {
      // new path
    }
  }
}
```

---

## Дополнительно: `DbContextOptions.provider` → `DbContextOptions.connection`

Для улучшения DX рекомендуется изменить API на:

```ts
export interface DbContextOptions {
  // Вместо: provider: DatabaseProvider
  connection: {
    type: 'postgres' | 'mysql' | 'mssql' | 'sqlite';
    connectionString: string;
    pool?: ConnectionPoolOptions;
    circuitBreaker?: CircuitBreakerOptions;
    // ...все опции провайдера здесь
  };
  performance?: PerformanceOptions;
  // ...
}

// DbContext сам создаёт провайдер
protected createProvider(connection: ConnectionOptions): DatabaseProvider {
  switch (connection.type) {
    case 'postgres': return new PostgresProvider(connection);
    case 'mysql': return new MySqlProvider(connection);
    // ...
  }
}
```

Это скрывает детали реализации провайдера от пользователя и делает API consistent.
