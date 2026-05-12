# Issue #05 — God Class `Queryable<T>`: Нарушение Принципа Единственной Ответственности

**Severity:** High  
**Category:** Architecture / Maintainability / SRP  
**Affected files:**
- `packages/core/src/query/Queryable.ts` (~1550 строк)

---

## Описание проблемы

`Queryable<T>` — монолитный класс на 1550+ строк, который одновременно выполняет **10 различных обязанностей**. Это классический God Object — один из наиболее известных антипаттернов в объектно-ориентированном дизайне.

---

## Что делает `Queryable<T>` прямо сейчас

| Обязанность | Строки | Методы |
|---|---|---|
| Fluent query building (where, orderBy, skip, take, ...) | ~200 | 20+ |
| SQL generation делегирование в QueryBuilder | ~50 | 2 |
| Выполнение запросов через DatabaseProvider | ~50 | 2 |
| Row materialization (mapRowToEntity) | ~120 | 6 (дублируют RowMaterializer!) |
| L2 EntityCache lookup/store | ~60 | 3 |
| Predicate parsing (regex, кэш, fallback) | ~100 | 4 |
| Property extraction из лямбд (regex) | ~80 | 4 |
| Fallback resilience (sequential, hedged) | ~200 | 5 |
| Fallback throttling (global static state) | ~50 | 1 |
| Global filter application | ~20 | 1 |
| Client-side aggregates (sum, avg, min, max) | ~100 | 5 |
| Monkey-patching toArray для except/intersect/concat | ~80 | 3 |
| AbortSignal handling | ~10 | 1 |
| Count cache management (static) | ~100 | 4 |
| CTE support (partial) | ~30 | 1 |

---

## Технические сложности

### 1. Дублирование с `RowMaterializer`

`RowMaterializer` был создан для централизации логики материализации строк, но `Queryable` всё ещё содержит полную копию той же логики:

```ts
// В Queryable.ts (строки 1197-1337):
private mapRowToEntity(row: unknown): T { ... }
private shouldUseL2Cache(...): boolean { ... }
private tryGetFromCache(...): T | null { ... }
private materializeEntity(...): T { ... }
private rememberInCache(...): void { ... }
private notifyMaterialized(...): void { ... }
private convertValue(value: unknown, type: string): unknown { ... }

// В RowMaterializer.ts — ИДЕНТИЧНЫЙ КОД:
public mapRowToEntity(row: unknown): T { ... }
private shouldUseL2Cache(...): boolean { ... }
private tryGetFromCache(...): T | null { ... }
private materializeEntity(...): T { ... }
private rememberInCache(...): void { ... }
private notifyMaterialized(...): void { ... }
private convertValue(value: unknown, type: string): unknown { ... }
```

При этом `Queryable._materializer` (экземпляр `RowMaterializer`) используется только в `handlePrimaryRows`, а все приватные методы выше в `Queryable` — избыточные копии. Изменение логики конвертации типов нужно делать в двух местах.

### 2. Методы `except()`, `intersect()`, `concat()` monkey-patch `toArray`

```ts
public except(other: Queryable<T>): Queryable<T> {
  const cloned = this.clone();
  const boundOriginal = cloned.toArray.bind(cloned);
  cloned.toArray = async function (this: Queryable<T>): Promise<T[]> {
    const thisResults = await boundOriginal();
    const otherResults = await other.toArray();
    // JSON.stringify для сравнения — O(n²) с memory allocation
    const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
    return thisResults.filter((item) => !otherSet.has(JSON.stringify(item)));
  }.bind(cloned);
  return cloned;
}
```

Это анти-паттерн по нескольким причинам:
- `first()`, `count()`, `any()`, `paginate()` не вызывают `toArray()` внутри себя — они обращаются к `executeAndMaterialize()` напрямую. Monkey-patch `toArray` не работает для них.
- Цепочка вызовов `except().where()` — `where` применяется до `except`, но визуально читается как "после".
- `JSON.stringify` для сравнения O(n²) — на больших наборах данных это OOM.

### 3. Fallback logic занимает 35% класса

Около 550 строк (из 1550) — это resilience-логика (fallback, hedging, throttling). Она полностью ортогональна бизнес-логике построения запросов и не должна быть частью `Queryable`.

### 4. Невозможно unit-тестировать отдельные части

Из-за того, что всё слито в один класс:
- Нельзя протестировать throttling-логику без создания полного `Queryable` с моком провайдера
- Нельзя протестировать materialization без запуска query builder
- Нельзя проверить L2 cache без полного стека

---

## Предлагаемое решение: декомпозиция на специализированные компоненты

### Итоговая целевая архитектура

```
Queryable<T>                   (~300 строк)
  └── QueryModelBuilder         Fluent API: where/orderBy/skip/take/...
  └── QueryExecutor             Выполнение через DatabaseProvider
  └── RowMaterializer           Row → Entity mapping (уже существует, убрать дубль)
  └── FallbackExecutor          Resilience: sequential/hedged fallback
  └── FallbackThrottle          Rate limiting for fallbacks
  └── CountCacheManager         Count cache lookup/store
  └── PredicateTranslator       Lambda → SQL (или throw если нет трансформера)
  └── SelectorExtractor         Lambda → column names extraction
```

### Пример разделения `FallbackExecutor`

```ts
// packages/core/src/query/FallbackExecutor.ts
export class FallbackExecutor<T> {
  constructor(
    private readonly fallbacks: QueryFallback<T>[],
    private readonly policy: FallbackPolicy,
    private readonly throttle: FallbackThrottle,
    private readonly logger?: SqlLogger
  ) {}

  async executeWithFallback<R>(
    primary: () => Promise<R>,
    fallbackFn: (fb: QueryFallback<T>) => Promise<R | null>
  ): Promise<R> { ... }

  async executeHedged<R>(
    primary: () => Promise<R>,
    fallbackFn: (fb: QueryFallback<T>) => Promise<R | null>,
    delayMs: number
  ): Promise<R> { ... }
}
```

### Пример разделения `CountCacheManager`

```ts
// packages/core/src/query/CountCacheManager.ts
export class CountCacheManager {
  private readonly cache: Map<string, { value: number; ts: number }>;
  private readonly inflightMap: Map<string, Promise<number>>;

  constructor(private readonly options: CountCacheOptions) {}

  async getOrFetch(key: string, fetch: () => Promise<number>): Promise<number> {
    // single-flight + TTL logic здесь
  }

  invalidateByPrefix(prefix: string): void { ... }
  clear(): void { ... }
}
```

---

## Объём рефакторинга

| Файл | Текущий размер | После рефакторинга |
|---|---|---|
| `Queryable.ts` | 1550 строк | ~300 строк |
| `RowMaterializer.ts` | 130 строк | 130 строк (убрать дубль из Queryable) |
| `FallbackExecutor.ts` | новый | ~200 строк |
| `CountCacheManager.ts` | новый | ~100 строк |
| `SelectorExtractor.ts` | новый | ~80 строк |
| `FallbackThrottle.ts` | новый | ~60 строк |
