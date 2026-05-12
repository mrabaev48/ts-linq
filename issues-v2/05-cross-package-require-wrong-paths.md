# Issue #05 — `require()` с Неверными Путями После Package Split

**Severity:** High  
**Status:** Ухудшилось — пути сломаны после разбиения на пакеты  
**Affected files:**
- `packages/orm/src/DbContext.ts` (строки 277, 282, 308, 325, 368, 427, 476)

---

## Описание проблемы

После PR #21 `packages/core` разбит на отдельные пакеты. `packages/orm` и `packages/query` — 
теперь независимые npm-пакеты с именами `@ts-linq/orm` и `@ts-linq/query`.

Однако `DbContext.ts` по-прежнему использует **относительные пути** для `require()`:

```ts
// packages/orm/src/DbContext.ts:277
require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }

// packages/orm/src/DbContext.ts:325
require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }

// packages/orm/src/DbContext.ts:368
const entities = require('../metadata/MetadataStorage').MetadataStorage.getEntities();

// packages/orm/src/DbContext.ts:427
const qb = require('../query/QueryBuilder') as { QueryBuilder: { invalidateForEntity: ... } };

// packages/orm/src/DbContext.ts:476
const qb = require('../query/QueryBuilder') as { QueryBuilder: { invalidateForEntity: ... } };
```

## Почему пути сломаны

Файл `packages/orm/src/DbContext.ts` находится в пакете `@ts-linq/orm`.

`require('../query/Queryable')` резолвит относительно **текущей директории**:
```
packages/orm/src/DbContext.ts
  → ../query = packages/orm/query
  → packages/orm/query/Queryable  ← ФАЙЛ НЕ СУЩЕСТВУЕТ
```

После компиляции в `packages/orm/dist/`, путь аналогично:
```
packages/orm/dist/DbContext.js
  → ../query/Queryable = packages/orm/dist/query/Queryable  ← НЕ СУЩЕСТВУЕТ
```

## Почему код не упал сразу

Все `require()` вызовы завёрнуты в `try { ... } catch { ... }`:

```ts
// packages/orm/src/DbContext.ts:274-296
try {
  (
    require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
  ).Queryable.clearCountCache();
  // ...
} catch (e) {
  // logInternalError('DbContext.commitTransaction.invalidateCaches', e);
  // ← Ошибка заглушена! Кэш не инвалидируется, но никто не знает.
}
```

Функциональность **тихо ломается**: после `commitTransaction()` или `rollbackTransaction()` 
кэш счётчиков (`_countCache`) не очищается. Это приводит к устаревшим данным после транзакций.

## Полный список сломанных операций

| Метод | Сломанный require() | Эффект |
|---|---|---|
| `commitTransaction()` | `../query/Queryable` | countCache не очищается |
| `commitTransaction()` | `@ts-linq/metrics-safe` | метрики не отправляются |
| `rollbackTransaction()` | `../query/Queryable` | countCache не очищается |
| `computeNeedFullL2Clear()` | `../metadata/MetadataStorage` | кэш-политики не применяются |
| `invalidateSqlCacheByNames()` | `../query/QueryBuilder` | SQL кэш не инвалидируется |
| `cache.invalidateByEntity()` | `../query/QueryBuilder` | публичный API не работает |

## Предлагаемое решение

### Шаг 1: Заменить все dynamic require() на статические импорты

```ts
// packages/orm/src/DbContext.ts
import { Queryable } from '@ts-linq/query';
import { QueryBuilder } from '@ts-linq/query';
import { MetadataStorage } from '@ts-linq/metadata';
```

### Шаг 2: Добавить зависимости в package.json

```json
// packages/orm/package.json
{
  "dependencies": {
    "@ts-linq/query": "workspace:*",
    "@ts-linq/metadata": "workspace:*"
  }
}
```

### Шаг 3: Убедиться в отсутствии циклов

Граф зависимостей должен быть ацикличен:
```
@ts-linq/orm → @ts-linq/query → @ts-linq/ast
@ts-linq/orm → @ts-linq/metadata
```

Если `@ts-linq/query` зависит от `@ts-linq/orm` — это цикл, нужно выделить общий тип
в `@ts-linq/types`.
