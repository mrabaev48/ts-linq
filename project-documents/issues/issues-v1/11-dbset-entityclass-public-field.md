# Issue #11 — `DbSet._entityClass` — Публичное Поле: Нарушение Инкапсуляции

**Severity:** Medium  
**Category:** Architecture / Type Safety / Encapsulation  
**Affected files:**
- `packages/core/src/context/DbSet.ts`
- `packages/core/src/context/DbContext.ts` (метод `set()`)

---

## Описание проблемы

Поле `_entityClass` в классе `DbSet<T>` объявлено как **`public`**:

```ts
export class DbSet<T extends object> {
  public _entityClass: new () => T;  // ← public!
  private _provider: DatabaseProvider;
  private _changeTracker: ChangeTracker;
  ...
}
```

`DbContext.set()` мутирует это поле напрямую:

```ts
public set<T extends object>(entityClass: new () => T): DbSet<T> {
  ...
  const dbSet = this._dbSets.get(normalized) as unknown as DbSet<T>;
  dbSet._entityClass = entityClass; // ← внешняя мутация публичного поля!
  return dbSet;
}
```

---

## Технические сложности

### 1. Нарушение инкапсуляции

`_entityClass` — внутреннее поле, управляющее типом сущности в DbSet. По конвенции `_prefixedPrivate` поля — это поля, которые должны быть `private`. Объявление их `public` открывает возможность изменения извне, что нарушает инварианты класса.

Любой код с доступом к `DbSet<T>` может изменить тип сущности:

```ts
const dbSet = ctx.users;
(dbSet as any)._entityClass = Product; // ← меняем тип!
// Теперь ctx.users.toArray() вернёт Product-объекты с User-метаданными
```

### 2. Причина — неправильный дизайн кэша `_dbSets`

`DbContext` хранит один `DbSet` на сущность:

```ts
private _dbSets: Map<Function, DbSet<object>> = new Map();
```

Когда вызывается `ctx.set(DecoratedUser)` (где `DecoratedUser` — подкласс или decorated вариант), метод ищет `DbSet` для оригинального класса `User`, находит его с типом `DbSet<object>`, и затем **меняет `_entityClass`** чтобы вернуть `DbSet<DecoratedUser>`.

Это — хак для поддержки decorated-классов (ts-patch трансформер создаёт обёрточные классы), а не правильное архитектурное решение.

### 3. Возможна рассинхронизация типов

После `dbSet._entityClass = entityClass`:
- Метаданные в `MetadataStorage` зарегистрированы для `User`
- `_entityClass` теперь указывает на `DecoratedUser`
- `MetadataStorage.getEntity(DecoratedUser)` может вернуть `undefined` если `DecoratedUser` не зарегистрирован отдельно

Это приводит к ситуации когда `Queryable` получает неверные метаданные для SQL-генерации.

### 4. Тип `DbSet<object>` в `_dbSets` полностью стирает generic

```ts
private _dbSets: Map<Function, DbSet<object>> = new Map();
// ↑ Тип User полностью стёрт до DbSet<object>
// Все type-safe операции работают через cast: as unknown as DbSet<T>
```

Это означает, что вся type-safety вокруг `DbSet` на уровне `DbContext` — фасад. Внутри хранится `DbSet<object>`.

---

## Предлагаемое решение

### Шаг 1: Сделать `_entityClass` приватным, добавить `readonly`

```ts
export class DbSet<T extends object> {
  private readonly _entityClass: new () => T;  // private + readonly
  ...
}
```

### Шаг 2: Убрать прямую мутацию из `DbContext.set()`

Вместо мутации — правильный lookup с учётом decorated-классов:

```ts
public set<T extends object>(entityClass: new () => T): DbSet<T> {
  // Нормализуем к оригинальному конструктору
  const normalized = this.resolveOriginalClass(entityClass);
  
  if (!this._dbSets.has(normalized)) {
    throw new Error(`DbSet for ${entityClass.name} is not registered. ` +
      `Call ctx.register(${entityClass.name}) or ensure the entity is decorated.`);
  }
  
  // Возвращаем с правильным generic-cast, без мутации
  return this._dbSets.get(normalized) as unknown as DbSet<T>;
}

private resolveOriginalClass(entityClass: Function): Function {
  const getOwn = (Reflect as unknown as { getOwnMetadata?: (...) => unknown }).getOwnMetadata;
  const maybe = getOwn?.('orm:original', entityClass);
  return typeof maybe === 'function' ? maybe : entityClass;
}
```

### Шаг 3: Хранить `_dbSets` с правильным типом через WeakMap

Для поддержки `decorated → original` маппинга использовать явную структуру:

```ts
private _dbSets: Map<Function, DbSet<object>> = new Map();
// Маппинг decorated class → original class
private _classAliases: Map<Function, Function> = new Map();

private initializeDbSets(): void {
  for (const entity of entities) {
    const original = getOriginal(entity.target);
    const dbSet = new DbSet<object>(original, ...);
    this._dbSets.set(original, dbSet);
    
    // Регистрируем алиас если decorated отличается от original
    if (entity.target !== original) {
      this._classAliases.set(entity.target, original);
    }
  }
}
```

---

## Дополнительно: `_entityClass` через TypeScript `accessor` (Stage 3)

Если проект использует TS5 Stage-3 decorators, можно использовать `accessor` keyword:

```ts
export class DbSet<T extends object> {
  // accessor автоматически создаёт get/set
  // get доступен публично, set — internal
  private _entityClass: new () => T;

  get entityClass(): new () => T {
    return this._entityClass;
  }

  // Setter доступен только внутри пакета через friend-pattern или package-level
}
```
