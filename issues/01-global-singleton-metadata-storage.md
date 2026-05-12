# Issue #01 — Global Singleton MetadataStorage: Test Isolation and Multi-Schema Contamination

**Severity:** Critical  
**Category:** Architecture / Testability  
**Affected files:**
- `packages/core/src/metadata/MetadataStorage.ts`
- `packages/core/src/context/DbContext.ts` (`initializeDbSets`)
- `packages/core/src/decorators/*.ts`

---

## Описание проблемы

`MetadataStorage` реализован как классический Singleton через приватный статический instance:

```ts
export class MetadataStorage {
  private static instance: MetadataStorage;

  public static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }
}
```

Все декораторы (`@Entity`, `@Column`, `@PrimaryKey`, `@OneToMany` и т.д.) регистрируют метаданные в этот единственный глобальный реестр на уровне процесса. Никакой изоляции между тестами, между разными `DbContext`-ами или между тест-ранами не предусмотрено.

---

## Технические сложности

### 1. Тесты загрязняют друг друга

Поскольку `MetadataStorage` — синглтон уровня процесса, и декораторы выполняются при загрузке модуля, все тесты в одном Jest-воркере делят один и тот же реестр сущностей. Тест А, объявивший `@Entity class Foo`, делает `Foo` видимой для всех последующих тестов — даже если они не импортируют `Foo`.

```ts
// test-a.ts
@Entity({ name: 'foo' }) class Foo { ... }
// Теперь Foo навсегда в MetadataStorage для всех тестов в воркере

// test-b.ts
const entities = MetadataStorage.getEntities();
// ['Foo', 'User', 'Product', ...] — всё что угодно из других тестов
```

Метод `MetadataStorage.clear()` существует, но его нигде нет в автоматических `beforeEach`/`afterEach`, и разработчики скорее всего не знают, что его нужно вызывать.

### 2. `initializeDbSets()` создаёт DbSet для ВСЕХ глобально зарегистрированных сущностей

```ts
private initializeDbSets(): void {
  const entities = MetadataStorage.getEntities(); // ← ВСЕ глобальные
  for (const entity of entities) {
    const dbSet = new DbSet<object>(...);
    this._dbSets.set(original, dbSet);
    // ← auto-property тоже создаётся для каждой!
    Object.defineProperty(this, propertyName, { get: () => dbSet, ... });
  }
}
```

Если в проекте есть несколько `DbContext` для разных схем (например, `ReadDbContext` и `WriteDbContext`), оба получат DbSet для всех сущностей из всего приложения — не только для тех, что явно с ними связаны.

### 3. Регистрация в `DbContext.register()` vs. декоратор

В `README.md` упоминается `ctx.register(User)`, но `DbContext` не имеет публичного метода `register`. Это означает, что всё держится на побочном эффекте импорта модуля с декоратором (`import './User'`). Порядок импортов имеет значение — ещё одна скрытая зависимость.

### 4. ESM и Hot Reload несовместимы с синглтоном

В Next.js, Vite и других инструментах с HMR модули могут перезагружаться, при этом синглтон не сбрасывается. Декораторы выполняются повторно и регистрируют дублирующиеся сущности в уже существующий реестр.

### 5. Невозможно иметь несколько баз с одинаковыми именами классов

Если приложение работает с двумя схемами (multi-tenant с разными моделями), нельзя иметь класс `User` в обоих контекстах — синглтон хранит по конструктору, а имя класса уже занято.

---

## Предлагаемое решение

### Шаг 1: Перейти от синглтона к контекстному реестру

```ts
// Новый API: MetadataRegistry — не синглтон
export class MetadataRegistry {
  private entities: Map<Function, EntityMetadata> = new Map();
  private builders: Map<Function, EntityMetadataBuilder> = new Map();

  addEntity(target: Function, tableName?: string): void { ... }
  addColumn(target: Function, column: ColumnMetadata): void { ... }
  getEntity(target: Function): EntityMetadata | undefined { ... }
  getEntities(): EntityMetadata[] { ... }
  clear(): void { ... }
}

// Глобальный реестр по умолчанию (для обратной совместимости)
export const defaultRegistry = new MetadataRegistry();
```

### Шаг 2: Декораторы принимают опциональный реестр

```ts
export function Entity(options: EntityOptions, registry = defaultRegistry): ClassDecorator {
  return (target) => registry.addEntity(target, options.name);
}
```

### Шаг 3: DbContext принимает и хранит свой реестр

```ts
export abstract class DbContext {
  constructor(options: DbContextOptions) {
    this._registry = options.registry ?? defaultRegistry;
  }

  private initializeDbSets(): void {
    const entities = this._registry.getEntities(); // только из своего реестра
    ...
  }
}
```

### Шаг 4: Тест-утилита для изоляции

```ts
export function createIsolatedRegistry(): MetadataRegistry {
  return new MetadataRegistry();
}

// В тестах:
beforeEach(() => {
  testRegistry = createIsolatedRegistry();
});
```

---

## Приоритет фикса

Это блокер для:
- Параллельного запуска тестов
- Multi-tenant архитектуры с разными схемами
- Правильного использования в Next.js / Fastify с HMR
