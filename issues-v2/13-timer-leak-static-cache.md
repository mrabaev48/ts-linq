# Issue #13 — Static `_defaultCache` Не Управляем; Timer Leak

**Severity:** Medium  
**Status:** Частично исправлено — dispose() добавлен, но static cache не управляем  
**Affected files:**
- `packages/query/src/QueryBuilder.ts` (строка 13)
- `packages/query/src/EnhancedSqlCache.ts`

---

## Что улучшилось

`EnhancedSqlCache` теперь имеет метод `dispose()`, который вызывает `clearInterval()`:

```ts
// packages/query/src/EnhancedSqlCache.ts:413-415
if (this.cleanupInterval) {
  clearInterval(this.cleanupInterval);
  this.cleanupInterval = undefined;
}
```

Это хорошо. Но проблема со статическим кэшем в `QueryBuilder` не решена.

## Оставшаяся проблема: Static _defaultCache

```ts
// packages/query/src/QueryBuilder.ts:13
private static _defaultCache: EnhancedSqlCache = new EnhancedSqlCache();
```

Этот кэш создаётся при первом импорте модуля и **никогда не уничтожается** автоматически:

- `DbContext.dispose()` вызывает только `this._provider.disconnect()` — не трогает QueryBuilder
- `EnhancedSqlCache` при создании стартует `setInterval` (если TTL задан)
- Статический `_defaultCache` существует на протяжении жизни всего процесса

### Утечка в тестовой среде

```ts
// В Jest каждый тест-файл:
import { QueryBuilder } from '@ts-linq/query';
// → создаёт статический _defaultCache с setInterval
// → после окончания тестов setInterval продолжает работать
// → Jest может зависнуть (process не завершается из-за активного таймера)
```

`EnhancedSqlCache` использует `.unref()` для смягчения:

```ts
// packages/query/src/EnhancedSqlCache.ts:397
const maybe = this.cleanupInterval as unknown as { unref?: () => void } | undefined;
maybe?.unref?.();
```

`.unref()` не останавливает таймер — он лишь не мешает завершению процесса. Но память всё
равно утекает между тестами.

## Предлагаемое решение

```ts
// packages/query/src/QueryBuilder.ts

export class QueryBuilder {
  // Убрать static _defaultCache
  private readonly _cache: EnhancedSqlCache;

  constructor(
    dialect: SqlDialect,
    loggerRef?: unknown,
    providerLabel?: string,
    externalCache?: SqlCache,
    cacheNamespace?: string
  ) {
    // Каждый экземпляр управляет своим кэшем
    this._cache = externalCache instanceof EnhancedSqlCache
      ? externalCache
      : new EnhancedSqlCache();
  }
  
  public dispose(): void {
    this._cache.dispose();
  }
}
```

`DbContext.dispose()` должен вызывать `this._sqlBuilder.dispose()`.
