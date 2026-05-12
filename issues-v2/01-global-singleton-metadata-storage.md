# Issue #01 — Global Singleton MetadataStorage

**Severity:** Critical  
**Status:** Остаётся (перемещён в `@ts-linq/metadata`)  
**Affected files:**
- `packages/metadata/src/MetadataStorage.ts`

---

## Описание проблемы

`MetadataStorage` по-прежнему реализован через `private static instance`:

```ts
// packages/metadata/src/MetadataStorage.ts:11
export class MetadataStorage {
  private static instance: MetadataStorage;  // ← процессовый синглтон
  private entities: Map<Function, EntityMetadata> = new Map();
  private builders: Map<Function, EntityMetadataBuilder> = new Map();
  
  public static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }
}
```

Перенос в отдельный пакет `@ts-linq/metadata` улучшил изоляцию на уровне дистрибуции,
но не решил проблему: **один синглтон на весь процесс**.

## Последствия

### 1. Параллельные тесты загрязняют друг друга

```ts
// test-a.spec.ts
@Entity('users') class User { ... }

// test-b.spec.ts  
@Entity('users') class UserMock { ... }  
// Оба пишут в один глобальный реестр → один перезаписывает другой
```

`MetadataStorage.clear()` существует, но требует явного вызова в каждом `afterEach/afterAll`.

### 2. Multi-tenant невозможен

Нельзя иметь два `DbContext` с разными схемами сущностей в одном процессе.

### 3. ESM / Worker Threads

В Worker Threads каждый поток имеет свой модульный граф — синглтон не шарится.
Если библиотека когда-либо перейдёт на ESM, поведение изменится без предупреждения.

## Предлагаемое решение

Передавать реестр через `DbContextOptions`:

```ts
interface DbContextOptions {
  provider: DatabaseProvider;
  registry?: MetadataRegistry;  // опциональный — если не передан, создаётся новый
  ...
}

export class DbContext {
  private _registry: MetadataRegistry;
  
  constructor(options: DbContextOptions) {
    this._registry = options.registry ?? MetadataRegistry.createDefault();
    ...
  }
}
```

`MetadataStorage.getInstance()` остаётся для обратной совместимости, но декораторы
должны поддерживать передачу реестра явно.
