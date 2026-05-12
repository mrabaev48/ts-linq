# Issue #15 — 143+ `as unknown as` — Хуже чем в v1

**Severity:** Medium  
**Status:** Ухудшилось (было 117, стало 143+)  
**Affected files:**
- Весь проект (все пакеты)

---

## Описание проблемы

```bash
$ grep -r "as unknown as" packages --include="*.ts" | grep -v dist | grep -v test | wc -l
143
```

Package split увеличил количество `as unknown as` на 26 вхождений. Новые unsafe casts
появились в cross-package коде: `packages/orm/src/DbSet.ts` (8+), `packages/orm/src/DbContext.ts` (20+).

## Наиболее опасные паттерны

### 1. Cross-package duck typing (новые в v2)

```ts
// packages/orm/src/DbSet.ts:167-178
(
  this._provider.loggerRef as unknown as {
    crossQuery?: (p: { op: 'IN-chunk'; chunks: number; ... }) => void;
  }
)?.crossQuery?.({ ... });
```

`crossQuery` — метод, которого нет в публичном интерфейсе `DatabaseProvider`. Каждый раз
создаётся inline-тип. Если сигнатура изменится — TypeScript не предупредит.

### 2. Приватные поля через cast

```ts
// packages/query/src/Queryable.ts:343-345
(next as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks = [
  ...((this as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks || [])
];
```

### 3. Reflect без типов

```ts
// packages/metadata/src/MetadataStorage.ts:22-23
const getOwn = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
  .getOwnMetadata;
```

Повторяется в каждом файле вместо единого объявления.

## Предлагаемое решение

### Шаг 1: `tsconfig.json` — добавить типы reflect-metadata

```json
{
  "compilerOptions": {
    "types": ["reflect-metadata"]
  }
}
```

Убирает необходимость во всех `(Reflect as unknown as ...)` — ~15 вхождений.

### Шаг 2: Добавить опциональные методы в DatabaseProvider

```ts
export abstract class DatabaseProvider {
  // Вместо duck typing через cast:
  protected onEntityMaterialized?(entity: object, metadata: EntityMetadata): void;
  crossQuery?(params: CrossQueryParams): void;
}
```

### Шаг 3: Аудит по категориям

| Категория | Количество | Действие |
|---|---|---|
| Reflect API | ~20 | `types: ["reflect-metadata"]` |
| Logger duck typing | ~25 | Расширить интерфейс SqlLogger |
| Private cross-parameterization | ~15 | `protected` + helper method |
| Provider duck typing | ~15 | Добавить в DatabaseProvider |
| Generic erasure | ~50 | Постепенный рефактор |
| Legacy | ~18 | Постепенный рефактор |
