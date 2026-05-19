# Issue #02 — Статические Мутируемые Поля в Queryable

**Severity:** Critical  
**Status:** Остаётся (перемещён в `@ts-linq/query`)  
**Affected files:**
- `packages/query/src/Queryable.ts`

---

## Описание проблемы

В `Queryable<T>` объявлено 8 `private static` полей, которые шарятся между всеми экземплярами
в пределах процесса:

```ts
// packages/query/src/Queryable.ts:44-72
private static _countCache: Map<string, { value: number; ts: number }> = new Map();
private static readonly _COUNT_CACHE_MAX = 2000;
private static _inflightCounts: Map<string, Promise<number>> = new Map();
private static _selectorPropsCache: Map<string, string[]> = new Map();
private static _keySelectorCache: Map<string, string> = new Map();
private static _includePropCache: Map<string, string> = new Map();
private static _fallbackWindowStart: number = 0;
private static _fallbackUsedInWindow: number = 0;
private static _fallbackLastAttemptAt: number = 0;
```

## Технические сложности

### 1. Multi-tenant опасность

Два `DbContext` (например, tenant A и tenant B) разделяют один `_countCache`.
Данные tenant A могут загрязнить кэш tenant B:

```ts
// Tenant A context
const countA = await ctxA.users.count(); // записывает в Queryable._countCache

// Tenant B context — читает из того же кэша!
const countB = await ctxB.users.count(); // может вернуть данные A
```

### 2. Throttle-состояние глобально

`_fallbackWindowStart`, `_fallbackUsedInWindow`, `_fallbackLastAttemptAt` — это throttle-счётчики
для fallback-операций. При высокой нагрузке одного контекста throttle блокирует другие контексты.

### 3. Параллельные тесты — flaky

Статические кэши не очищаются между тестами. Тест A наполняет `_countCache`, тест B получает
устаревший результат. Порядок тестов влияет на результат.

### 4. Публичный метод clearCountCache() — недостаточная защита

```ts
public static clearCountCache(): void {
  Queryable._countCache.clear();
}
```

Нет методов для очистки остальных 4 кэшей. При тестировании это требует прямого доступа к приватным полям.

## Предлагаемое решение

Перенести все кэши на уровень экземпляра (либо в `QueryBuilder`/`PerformanceOptions`):

```ts
export class Queryable<T> {
  // Теперь на уровне экземпляра через PerformanceOptions
  private readonly _countCacheInstance: CountCacheInstance;
  
  constructor(
    entityClass: new () => T,
    provider: DatabaseProvider,
    performance?: PerformanceOptions  // содержит CountCache инстанс
  ) {
    this._countCacheInstance = performance?.countCache ?? new InMemoryCountCache();
  }
}
```

`_selectorPropsCache`, `_keySelectorCache`, `_includePropCache` можно оставить статическими —
они read-only по ключу (строка → строка) и не зависят от контекста. Но `_fallbackWindowStart`
и throttle-счётчики должны быть per-context.
