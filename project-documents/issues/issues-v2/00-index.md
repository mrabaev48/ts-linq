# Архитектурное Ревью ts-linq v2: Индекс Проблем

**Дата:** 2026-05-13  
**Ревьюер:** Senior TypeScript Software Architect  
**Базовая ветка:** `main` (commit `1bb5f91d`, после PR #21 `feat/split-packages-with-rules`)  
**Охват:** все пакеты монорепо после рефакторинга

---

## Что изменилось с v1 ревью

PR #21 произвёл масштабный split: `packages/core` разбит на 20+ специализированных пакетов
(`packages/orm`, `packages/query`, `packages/ast`, `packages/metadata`, `packages/dialect-*`,
`packages/provider-*`, `packages/plugin-*` и т.д.). Это значительное архитектурное улучшение.

| # | Проблема из v1 | Статус |
|---|---|---|
| 01 | Global singleton MetadataStorage | **Остаётся** (теперь в `@ts-linq/metadata`) |
| 02 | Static mutable fields in Queryable | **Остаётся** (теперь в `@ts-linq/query`) |
| 03 | saveChanges() не атомарен | **Остаётся** (теперь в `@ts-linq/orm`) |
| 04 | Function.toString() парсинг | **Улучшено** — where() теперь бросает вместо fallback |
| 05 | God Class Queryable | **Остаётся** — 1567 строк |
| 06 | require() внутри методов | **Ухудшилось** — пути сломаны после split |
| 07 | propertyName вместо columnName в SQL | **Остаётся** — BinaryVisitor не резолвит columnName |
| 08 | ChangeTracker без Identity Map | **Остаётся** |
| 09 | Клиентские агрегаты | **Остаётся** |
| 10 | 8 позиционных аргументов | **Улучшено** — DbContext/DbSet теперь используют options |
| 11 | DbSet._entityClass публичное поле | **Остаётся** |
| 12 | Timer leak в EnhancedSqlCache | **Частично исправлено** — dispose() добавлен, но static cache жив |
| 13 | having() тихий fallback | **Исправлено** ✅ |
| 14 | keysetPaginate хардкодит `?` | **Остаётся** |
| 15 | Дублирование SqlVisitor; имена пакетов | **Исправлено** ✅ (провайдеры переименованы) |
| 16 | 117+ `as unknown as` | **Ухудшилось** (теперь 143+) |
| 17 | monkey-patch toArray | **Остаётся** |
| 18 | Миграция трансформера | **Не выполнено** |

---

## Реестр Проблем v2

### Критические (Severity: Critical)

| # | Файл | Заголовок |
|---|---|---|
| [01](./01-global-singleton-metadata-storage.md) | `packages/metadata/src/MetadataStorage.ts` | **Global Singleton MetadataStorage** |
| [02](./02-static-mutable-state-in-queryable.md) | `packages/query/src/Queryable.ts` | **Статические мутируемые поля в Queryable** |
| [03](./03-savechanges-not-atomic.md) | `packages/orm/src/DbContext.ts` | **saveChanges() не атомарен** |
| [04](./04-all-and-find-broken-by-where-throws.md) | `packages/query/src/Queryable.ts`, `packages/orm/src/DbSet.ts` | **`all()` и `DbSet.find()` сломаны после where()-throw** |

### Высокие (Severity: High)

| # | Файл | Заголовок |
|---|---|---|
| [05](./05-cross-package-require-wrong-paths.md) | `packages/orm/src/DbContext.ts` | **require() с неверными путями после package split** |
| [06](./06-binaryvisitor-propertyname-not-columnname.md) | `packages/ast/src/visitors/BinaryVisitor.ts` | **BinaryVisitor использует propertyName вместо columnName** |
| [07](./07-changetracker-no-identity-map.md) | `packages/orm/src/ChangeTracker.ts` | **ChangeTracker без Identity Map; JSON.parse/stringify** |
| [08](./08-client-side-aggregates.md) | `packages/query/src/Queryable.ts` | **Клиентские агрегаты (sum, avg, min, max)** |
| [09](./09-transformer-or-mismatch.md) | `packages/transformer/src/ExpressionParser.ts` | **Transformer отклоняет `\|\|`, но runtime LogicalVisitor поддерживает OR** |

### Средние (Severity: Medium)

| # | Файл | Заголовок |
|---|---|---|
| [10](./10-queryable-god-class.md) | `packages/query/src/Queryable.ts` | **God Class Queryable (1567 строк)** |
| [11](./11-dbset-entityclass-public.md) | `packages/orm/src/DbSet.ts` | **DbSet._entityClass публичное поле** |
| [12](./12-softdelete-hardcodes-equals-zero.md) | `packages/query/src/GlobalFilterApplier.ts` | **Soft-delete хардкодит `= 0` — сломано для PostgreSQL** |
| [13](./13-timer-leak-static-cache.md) | `packages/query/src/QueryBuilder.ts` | **Static `_defaultCache` не управляем, timer leak** |
| [14](./14-keyset-paginate-hardcoded-placeholder.md) | `packages/query/src/Queryable.ts` | **keysetPaginate хардкодит `?` placeholder** |
| [15](./15-excessive-unknown-casts.md) | Весь проект | **143+ `as unknown as` — хуже чем в v1** |
| [16](./16-monkey-patch-toarray.md) | `packages/query/src/Queryable.ts` | **except/intersect/concat monkey-patch toArray** |
| [17](./17-remove-function-string-parsing.md) | `packages/query/src/Queryable.ts` | **Runtime-парсинг стрелочных функций — 11 методов, удалить полностью** |
| [18](./18-join-runtime-predicate-parsing.md) | `packages/query/src/Queryable.ts`, `JoinPredicateParser.ts` | **`join()` парсит ON-предикат через `.toString()` + regex** |
| [19](./19-dead-parsing-methods-in-property-extractor.md) | `packages/query/src/PropertyExtractor.ts` | **`extractPropertyName` и `extractIncludeProperty` — мёртвый код после issue #17** |

---

## Приоритет исправлений

### Фаза 1 — Регрессии (Немедленно)
1. **Issue #04** — исправить `all()` и `DbSet.find()` (не вызывать `where()` внутри)
2. **Issue #05** — заменить `require('../query/Queryable')` на нормальные импорты из `@ts-linq/query`
3. **Issue #03** — транзакция вокруг `saveChanges()`

### Фаза 2 — Data Integrity
4. **Issue #06** — columnName lookup в BinaryVisitor
5. **Issue #12** — soft-delete `= 0` → `= false` / диалект-специфично
6. **Issue #09** — OR в трансформере (согласовать с LogicalVisitor)

### Фаза 3 — Architecture
7. **Issue #01** — контекстный реестр вместо синглтона
8. **Issue #02** — убрать статические мутируемые поля
9. **Issue #07** — Identity Map в ChangeTracker

### Фаза 4 — Performance & Correctness
10. **Issue #08** — SQL-агрегаты
11. **Issue #16** — monkey-patch → SQL EXCEPT/INTERSECT
12. **Issue #14** — диалект-специфичные placeholders

### Фаза 5 — DX & Housekeeping
13. **Issue #10** — декомпозиция God Class
14. **Issue #11** — DbSet._entityClass приватность
15. **Issue #13** — timer lifecycle
16. **Issue #15** — аудит `as unknown as`
17. **Issue #17** — полный переход на трансформер; удалить runtime-парсинг функций

---

## Оценка (v2)

| Категория | v1 | v2 | Комментарий |
|---|---|---|---|
| Архитектура монорепо | 5/10 | 8/10 | Package split значительно улучшил изоляцию |
| Корректность SQL | 4/10 | 4/10 | columnName проблема осталась |
| Транзакционная безопасность | 3/10 | 3/10 | saveChanges всё ещё без транзакции |
| Тестируемость | 3/10 | 3/10 | Синглтон MetadataStorage не тронут |
| Type Safety | 5/10 | 4/10 | 143 unsafe casts (было 117) |
| Регрессии | — | 2/10 | all() и DbSet.find() сломаны |
| Production-readiness | 5/10 | 5/10 | Без изменений |
