# Issue #16 — Чрезмерное Использование `as unknown as` и `(Reflect as unknown as ...)`: Скрытые Баги за Фасадом TypeScript

**Severity:** Medium  
**Category:** Type Safety / Code Quality  
**Affected files:**
- `packages/core/src/context/DbContext.ts` (117+ вхождений `as unknown as` в проекте)
- `packages/core/src/metadata/MetadataStorage.ts`
- `packages/core/src/query/Queryable.ts`
- `packages/core/src/loading/LazyLoadingProxy.ts`

---

## Описание проблемы

В кодовой базе встречается **117+ вхождений** `as unknown as` — это тройной каст, обходящий систему типов TypeScript полностью. Кроме того, множество паттернов `(Reflect as unknown as { getOwnMetadata?: ... })` для обращения к Reflect API.

```ts
// Из MetadataStorage.ts:
const getOwn = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
  .getOwnMetadata;

// Из DbContext.ts:
(this._provider as unknown as { softDelete?: SoftDeleteOptions }).softDelete = options.softDelete;

// Из Queryable.ts:
(next as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks = [...];

// Из Queryable.ts:
const subqueryEntity = subquery._entityClass as unknown as new () => unknown;

// Из DbContext.ts (commitTransaction):
const { safeCacheSize } = require('metrics-safe') as {
  safeCacheSize: (logger: unknown, payload: { cache: 'entityL2'; ... }) => void;
};
```

---

## Технические сложности

### 1. `(Reflect as unknown as ...)` — обход отсутствия типов для `reflect-metadata`

Библиотека `reflect-metadata` добавляет методы `Reflect.defineMetadata` и `Reflect.getOwnMetadata`, которых нет в стандартном TypeScript `Reflect`. Вместо установки `@types/reflect-metadata` или правильного расширения интерфейса, код использует runtime-cast при каждом обращении:

```ts
// Вместо правильного решения:
// tsconfig.json: "types": ["reflect-metadata"]
// или:
// declare global { interface Reflect { getOwnMetadata(key: string, target: object): unknown; } }

// Используется повсюду:
(Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown }).getOwnMetadata?.('orm:cachePolicy', target)
```

Это приводит к:
- Дублированию одного и того же cast в каждом файле
- Ошибкам при изменении сигнатуры метода (TypeScript не проверит)
- Ложному ощущению type-safety (код "проходит" типы, но реальной проверки нет)

### 2. `(this._provider as unknown as {...}).softDelete = ...` — unsafe property injection

```ts
// В DbContext.constructor:
try {
  (this._provider as unknown as { softDelete?: SoftDeleteOptions }).softDelete = options.softDelete;
} catch { /* ignore */ }
```

Это запись во внутреннее `protected` поле провайдера через unsafe cast. Проблемы:
- Если поле переименуют или тип изменится — компилятор не предупредит
- `try/catch` скрывает реальные ошибки
- Это нарушение инкапсуляции (поле `protected`, но используется через cast снаружи)

### 3. `(next as unknown as { _fallbacks: ... })._fallbacks = ...` — доступ к приватным полям

```ts
// В Queryable.select():
(next as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks = [
  ...((this as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks || [])
];
```

Поле `_fallbacks` — `private`. Для доступа к нему с другим generic параметром используется `as unknown as`. Это полностью аннулирует private-доступ TypeScript.

**Настоящая причина:** `Queryable<T>` и `Queryable<TResult>` — разные параметризации одного класса, и TypeScript не позволяет доступ к приватным полям другой параметризации. Правильное решение — сделать `_fallbacks` `protected` с внутренним методом для копирования.

### 4. `provider.notifyEntityMaterialized` — unsafe duck typing

```ts
private notifyMaterialized(entity: T, metadata?: unknown): void {
  try {
    if (metadata)
      (
        this._provider as unknown as { notifyEntityMaterialized?: (e: T, m?: unknown) => void }
      ).notifyEntityMaterialized?.(entity, metadata);
  } catch { }
}
```

`DatabaseProvider` не имеет метода `notifyEntityMaterialized` в своём публичном API. Код проверяет его наличие через duck typing с `as unknown as`. Это приводит к тому, что:
- Метод существует только неявно
- Провайдеры не обязаны его реализовывать
- Нет документации о том, что этот метод можно/нужно переопределять

### 5. 117+ вхождений — системная проблема

Статистика:
```
$ grep -r "as unknown as" packages/core/src | grep -v test | grep -v dist | wc -l
117
```

Это не отдельные случаи — это системный паттерн обхода типов. Каждое такое место — потенциальный runtime error, который компилятор не поймает.

---

## Предлагаемое решение

### Шаг 1: Правильно сконфигурировать `reflect-metadata` типы

```json
// tsconfig.json:
{
  "compilerOptions": {
    "types": ["reflect-metadata"]  // ← добавить
  }
}
```

Это добавит правильные типы для `Reflect.defineMetadata`, `Reflect.getOwnMetadata` и т.д., убрав необходимость в каждом месте писать `(Reflect as unknown as ...)`.

### Шаг 2: Добавить `notifyEntityMaterialized` в `DatabaseProvider` как опциональный хук

```ts
export abstract class DatabaseProvider {
  ...
  // Опциональный хук для диагностики/профилирования
  protected onEntityMaterialized?(entity: object, metadata: EntityMetadata): void;
}
```

Тогда:
```ts
// Вместо unsafe cast:
this._provider.onEntityMaterialized?.(entity, metadata);
```

### Шаг 3: Использовать `protected` + методы клонирования для cross-parameterization

```ts
export class Queryable<T> {
  protected _fallbacks: Array<QueryFallback<T>> = []; // protected вместо private

  protected copyFallbacksFrom<TSource>(source: Queryable<TSource>): void {
    this._fallbacks = source._fallbacks as unknown as Array<QueryFallback<T>>;
    // Единственный cast — внутри метода с явной документацией
  }
}
```

### Шаг 4: Убрать unsafe injection softDelete через публичный метод провайдера

```ts
export abstract class DatabaseProvider {
  public configureSoftDelete(options: SoftDeleteOptions | undefined): void {
    this.softDelete = options;
  }
}

// В DbContext:
this._provider.configureSoftDelete(options.softDelete); // безопасно, типизировано
```

### Шаг 5: Аудит всех `as unknown as` и разбить на категории

| Категория | Количество | Решение |
|---|---|---|
| Reflect API | ~20 | `types: ["reflect-metadata"]` |
| Приватные поля cross-parameterization | ~15 | `protected` + helper methods |
| Provider duck typing | ~10 | Добавить в интерфейс |
| Generic erasure (`DbSet<object>`) | ~30 | Улучшить типы |
| Legacy/TODO casts | ~40 | Постепенно рефакторить |
