# Архитектурное Ревью ts-linq: Индекс Проблем

**Дата:** 2026-05-13  
**Ревьюер:** Senior TypeScript Software Architect  
**Версия проекта:** 1.0.0  
**Охват:** packages/core, packages/sqlite, packages/cli, общая монорепо-структура

---

## Краткое резюме

ts-linq — амбициозный ORM-проект, вдохновлённый Entity Framework Core. Проект содержит богатый функциональный охват: LINQ-style querying, change tracking, migrations, caching, observability, resilience. Однако ряд архитектурных решений создаёт серьёзные проблемы корректности, надёжности и масштабируемости.

Наиболее критичные проблемы:
1. Глобальный синглтон `MetadataStorage` делает параллельное тестирование невозможным
2. `saveChanges()` не атомарен — partial commits разрушают данные при ошибках
3. SQL генерируется с `propertyName` вместо `columnName` — неверные запросы
4. Статические мутируемые поля в `Queryable` делают multi-tenant использование опасным

---

## Реестр Проблем

### Критические (Severity: Critical)

| # | Файл | Заголовок | Краткое описание |
|---|---|---|---|
| [01](./01-global-singleton-metadata-storage.md) | `MetadataStorage.ts` | **Global Singleton MetadataStorage** | Единый реестр сущностей на уровень процесса. Тесты загрязняют друг друга. Multi-tenant невозможен. |
| [02](./02-static-mutable-state-in-queryable.md) | `Queryable.ts` | **Статические мутируемые поля в Queryable** | 15 process-global статических полей: кэши, fallback throttle, inflight counts — разделяются между всеми провайдерами. |
| [03](./03-saveChanages-not-atomic.md) | `DbContext.ts` | **`saveChanges()` не атомарен** | Нет транзакции вокруг цикла изменений. Partial commit при ошибке оставляет данные в inconsistent state. |
| [04](./04-predicate-parsing-fragile-and-unsafe.md) | `PredicateParser.ts` | **Runtime парсинг предикатов через `Function.toString()`** | Minification-unsafe. Тихий fallback к full table scan при ошибке парсинга. Кэш без entity-контекста. |

### Высокие (Severity: High)

| # | Файл | Заголовок | Краткое описание |
|---|---|---|---|
| [05](./05-queryable-god-class-srp-violation.md) | `Queryable.ts` | **God Class `Queryable<T>`** | 1550+ строк, 15 ответственностей. Дублирует `RowMaterializer`. Нарушение SRP. |
| [06](./06-dynamic-require-and-circular-dependencies.md) | `DbContext.ts` | **`require()` внутри методов** | Динамические `require()` в теле методов для разрыва циклических зависимостей. ESM-несовместимо. |
| [07](./07-wrong-column-names-in-sql-generation.md) | `BinaryVisitor.ts` | **Неверные имена столбцов в SQL** | `propertyName` используется вместо `columnName` в WHERE, ORDER BY. Soft delete хардкодит `= 0` (ломает PostgreSQL). |
| [08](./08-change-tracker-object-identity-and-json-clone.md) | `ChangeTracker.ts` | **ChangeTracker без Identity Map** | Object reference вместо PK для дедупликации. `JSON.parse(JSON.stringify)` ломается на Date, BigInt, циклических ссылках. |
| [09](./09-client-side-aggregates-no-sql-generation.md) | `Queryable.ts` | **Клиентские агрегаты** | `sum()`, `avg()`, `min()`, `max()`, `all()`, `contains()` загружают ВСЕ строки в память. Нет SQL `SUM()`, `AVG()` и т.д. |

### Средние (Severity: Medium)

| # | Файл | Заголовок | Краткое описание |
|---|---|---|---|
| [10](./10-provider-constructor-8-positional-args.md) | `DatabaseProvider.ts` | **8 позиционных аргументов в конструкторе** | Long Parameter List anti-pattern. Leaky abstraction. |
| [11](./11-dbset-entityclass-public-field.md) | `DbSet.ts` | **`DbSet._entityClass` публичное поле** | Нарушение инкапсуляции. `DbContext.set()` мутирует поле напрямую. |
| [12](./12-enhanced-sql-cache-timer-leak.md) | `EnhancedSqlCache.ts` | **Background timer leak в SQL кэше** | `setInterval` не останавливается при `DbContext.dispose()`. Статический `_defaultCache` не управляем. |
| [13](./13-having-silent-fallback-and-cte-not-implemented.md) | `Queryable.ts` | **`having()` тихо игнорирует предикат; CTE не реализован** | Fallback к `HAVING 1=1`. `withCte()` не генерирует `WITH` clause. |
| [14](./14-keyset-pagination-hardcoded-placeholder.md) | `Queryable.ts` | **`keysetPaginate()` хардкодит `?` placeholder** | Несовместимо с PostgreSQL (`$1`) и MSSQL (`@p1`). |
| [15](./15-duplicate-sqlvisitor-and-package-structure.md) | Структура пакетов | **Дублирование SqlVisitor; несоответствие имён пакетов** | Два идентичных `SqlVisitor`. Пакеты без `@ts-linq/` scope. Несоответствие exports и имён папок. |
| [16](./16-excessive-unknown-casts.md) | Весь проект | **117+ вхождений `as unknown as`** | Системный обход type system. Скрытые runtime ошибки. Неправильная конфигурация `reflect-metadata`. |
| [17](./17-monkey-patching-toarray-breaks-linq-chain.md) | `Queryable.ts` | **`except()`, `intersect()`, `concat()` monkey-patch toArray** | Ломают `first()`, `count()`, `any()`. `JSON.stringify` для сравнения объектов. |
| [18](./18-migrate-transformer-to-project2-approach.md) | `packages/transformer/` | **Миграция трансформера на подход project2** | Type brand scope guard, OR/NOT/IN/string methods, sentinel errors, 6→3 файла. |

---

## Приоритет исправлений

### Фаза 1 — Data Integrity (Немедленно)
1. **Issue #03** — добавить транзакцию в `saveChanges()`
2. **Issue #07** — исправить `propertyName` → `columnName` в SQL generation + soft delete `= false`
3. **Issue #13** — `having()` должен бросать, не молчать; убрать заглушку `1=1`

### Фаза 2 — Architecture (1-2 спринта)
4. **Issue #01** — контекстный реестр вместо синглтона
5. **Issue #02** — убрать статические мутируемые поля из Queryable
6. **Issue #06** — убрать динамические `require()`, разорвать циклы через DI

### Фаза 3 — Performance & Correctness (2-3 спринта)
7. **Issue #09** — SQL-агрегаты вместо client-side
8. **Issue #08** — Identity Map в ChangeTracker; structuredClone
9. **Issue #17** — SQL EXCEPT/INTERSECT вместо monkey-patch
10. **Issue #04** — стратегия по предикат-парсингу

### Фаза 4 — DX & Housekeeping (параллельно)
11. **Issue #10** — Options Object Pattern для DatabaseProvider
12. **Issue #11** — приватность DbSet._entityClass
13. **Issue #12** — timer lifecycle management
14. **Issue #14** — диалект-специфичные placeholders
15. **Issue #15** — дедупликация кода, синхронизация пакетов
16. **Issue #16** — аудит `as unknown as`, `reflect-metadata` типы
17. **Issue #05** — декомпозиция God Class Queryable

### Фаза 5 — Transformer Migration (отдельный трек)
18. **Issue #18** — миграция трансформера на подход из project2 (type brand scope guard, OR/NOT/IN/string methods, sentinel errors)

---

## Общая оценка

| Категория | Оценка | Комментарий |
|---|---|---|
| Функциональный охват | 8/10 | Богатый набор фич |
| Корректность SQL-генерации | 4/10 | propertyName/columnName, хардкод placeholder |
| Транзакционная безопасность | 3/10 | saveChanges без транзакции — критично |
| Тестируемость | 3/10 | Синглтон MetadataStorage блокирует изоляцию |
| Type Safety | 5/10 | 117 unsafe casts |
| Production-readiness | 5/10 | Статические кэши, timer leaks |
| API Design | 6/10 | Частично вдохновлён EF Core, но с отклонениями |
