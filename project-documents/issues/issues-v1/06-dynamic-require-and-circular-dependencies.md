# Issue #06 — `require()` Внутри Методов: Циркулярные Зависимости и CJS/ESM Несовместимость

**Severity:** High  
**Category:** Architecture / Build System / ESM Compatibility  
**Affected files:**
- `packages/core/src/context/DbContext.ts`
- `packages/core/src/migrations/DiffTypes.ts`
- `packages/core/src/utils/PrometheusEndpoint.ts`

---

## Описание проблемы

В нескольких ключевых местах используется динамический `require()` внутри тел методов вместо статических импортов на уровне модуля:

```ts
// DbContext.ts — метод commitTransaction():
public async commitTransaction(): Promise<void> {
  await this._provider.commitTransaction();
  try {
    (
      require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
    ).Queryable.clearCountCache();
    
    const { safeCacheSize } = require('metrics-safe') as { ... };
    safeCacheSize(...);
  } catch (e) { ... }
}

// DbContext.ts — метод rollbackTransaction():
public async rollbackTransaction(): Promise<void> {
  await this._provider.rollbackTransaction();
  try {
    (
      require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
    ).Queryable.clearCountCache();
  } catch (e) { ... }
}

// DbContext.ts — метод computeNeedFullL2Clear():
private computeNeedFullL2Clear(...): boolean {
  const entities = require('../metadata/MetadataStorage').MetadataStorage.getEntities();
  ...
}

// DbContext.ts — метод invalidateSqlCacheByNames():
private invalidateSqlCacheByNames(...): void {
  const qb = require('../query/QueryBuilder') as { ... };
  ...
}
```

---

## Технические сложности

### 1. Несовместимость с ESM

`require()` — это CommonJS API. В чистом ESM-окружении (Node.js с `"type": "module"` в package.json, Deno, современные bundlers) `require` не существует как глобальная функция. Вызов `require(...)` в рантайме выбросит `ReferenceError: require is not defined`.

Проект декларирует поддержку ESM (есть `tsconfig.esm.json`, `rollup.config.mjs`), но внутренний код использует CJS-примитивы. Это противоречие.

### 2. Причина использования `require()` — попытка разорвать циркулярные зависимости

Статические импорты в `DbContext.ts` невозможны из-за циклов:

```
DbContext → Queryable (для clearCountCache)
Queryable → DbContext (для GlobalFilterApplier, который использует MetadataStorage)
```

Динамический `require()` "разрывает" цикл на уровне модульной системы Node.js. Но это лечение симптома, а не причины.

### 3. Реальная причина цикла — нарушение DIP

`Queryable.clearCountCache()` — это статический метод, который `DbContext.commitTransaction()` должен вызывать. Но `DbContext` не должен знать о деталях реализации `Queryable`. Это нарушение принципа инверсии зависимостей.

Правильное решение: `DbContext` должен работать с абстракцией `CacheManager`, а не вызывать статический метод конкретного класса `Queryable`.

### 4. `require()` внутри `catch`/`try` маскирует реальные ошибки

```ts
try {
  (require('../query/Queryable') as ...).Queryable.clearCountCache();
} catch (e) {
  logInternalError('DbContext.commitTransaction.invalidateCaches', e);
}
```

Если `require` падает (например, в ESM), ошибка проглатывается в `catch`. Кэш не инвалидируется, но код продолжает работу как ни в чём не бывало. Пользователь не получает никакой диагностики.

### 5. `DiffTypes.ts` использует `require` для lazy-load comparators

```ts
// migrations/DiffTypes.ts:
const { diffColumns } = require('./comparators/ColumnComparator');
const { diffIndexes } = require('./comparators/IndexComparator');
```

Это code smell — модуль явно не хочет иметь статическую зависимость на компараторы. Скорее всего это тоже для разрыва цикла. Правильное решение — передавать компараторы через DI.

### 6. `PrometheusEndpoint.ts` — условный lazy import

```ts
// utils/PrometheusEndpoint.ts:
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pc = require('prom-client');
```

Здесь логика другая: `prom-client` — опциональная зависимость, которая может не быть установлена. Но правильный способ для ESM — это `await import('prom-client')` или `createRequire`.

---

## Предлагаемое решение

### Шаг 1: Ввести интерфейс `CacheInvalidator` и разорвать цикл через DI

```ts
// packages/core/src/cache/CacheInvalidator.ts
export interface CacheInvalidator {
  invalidateCountCache(): void;
  invalidateSqlCacheForEntities(entityNames: ReadonlySet<string>): void;
}
```

```ts
// packages/core/src/query/QueryableCacheInvalidator.ts
import { Queryable } from './Queryable';
import { QueryBuilder } from './QueryBuilder';

export class QueryableCacheInvalidator implements CacheInvalidator {
  invalidateCountCache(): void {
    Queryable.clearCountCache();
  }

  invalidateSqlCacheForEntities(entityNames: ReadonlySet<string>): void {
    for (const name of entityNames) {
      QueryBuilder.invalidateForEntity(name);
    }
  }
}
```

```ts
// DbContext получает CacheInvalidator через конструктор (DI)
export abstract class DbContext {
  constructor(options: DbContextOptions) {
    this._cacheInvalidator = options.cacheInvalidator 
      ?? new QueryableCacheInvalidator(); // default
  }

  public async commitTransaction(): Promise<void> {
    await this._provider.commitTransaction();
    this._cacheInvalidator.invalidateCountCache(); // ← статический import, нет цикла
  }
}
```

### Шаг 2: Опциональные зависимости через dynamic import (ESM-compatible)

```ts
// PrometheusEndpoint.ts
async function getPromClient() {
  try {
    return await import('prom-client');
  } catch {
    throw new Error(
      '[ts-linq] prom-client is not installed. ' +
      'Run: npm install prom-client'
    );
  }
}
```

### Шаг 3: Убрать `require` из `DiffTypes.ts`

Передавать компараторы через параметры функции:

```ts
// Вместо:
const { diffColumns } = require('./comparators/ColumnComparator');

// Использовать:
import { diffColumns } from './comparators/ColumnComparator';
import { diffIndexes } from './comparators/IndexComparator';
```

Если цикл существует — это симптом неправильной архитектуры слоёв.

---

## Сводка зависимостей для устранения циклов

```
Слой 1: types, interfaces
Слой 2: metadata (MetadataStorage) — зависит только от types
Слой 3: cache (EntityCache, CountCache, SqlCache) — зависит от types
Слой 4: query (Queryable, QueryBuilder) — зависит от metadata + cache
Слой 5: context (DbContext, DbSet) — зависит от query + cache
Слой 6: providers — зависит от context

Правило: каждый слой зависит только от нижних слоёв.
Нарушение: DbContext (слой 5) → Queryable (слой 4) — OK
           Queryable (слой 4) → DbContext (слой 5) — НАРУШЕНИЕ ЦИКЛА
```
