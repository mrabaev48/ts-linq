# Refactor Plan: Clean Code, SOLID, OOP Patterns, Tests

Цель: повысить качество кода, улучшить архитектуру (SOLID), покрыть тестами всевозможные сценарии, укрепить DX и производительность.

## Принципы
- Clean Code: понятные имена, малые функции, отсутствие дублирования, явные зависимости.
- SOLID: SRP/OPEN-CLOSED/LSP/ISP/DIP — применить к слоям provider/query/metadata/migrations.
- ООП-паттерны: где уместно — Strategy, Template Method, Factory, Builder, Specification, Adapter, Decorator, Composite.
- Тесты: позитивные/негативные/граничные сценарии, property-based, (опц) mutation.

## Метрики приёмки
- 0 TODO-комментариев в src.
- Снижение средн. размера файлов/функций на 20% в модулях query/providers.
- Покрытие тестами: модульные 90% критических модулей; интеграционные кейсы всех провайдеров включены по env.
- Линтер/Typedoc без ошибок; public API задокументирован.

## Фазы

### Фаза 1 — Quick Wins (1–2 дня) — [ГОТОВО]
- Именование: привести переменные/методы к единым правилам (глаголы для функций, существительные для сущностей).
- Удалить мёртвый код, упростить ветвления, использовать ранние return.
- Мелкие экстракции приватных методов в больших классах (Queryable, Providers).
- Линтер-правила: запрет any, мягкие пороги по сложности/длине.

### Фаза 2 — SOLID Pass (3–5 дней) — [ГОТОВО]
- DIP: усилить абстракции вокруг провайдеров/диалектов/логгеров (внедрение зависимостей, минимизация знания о конкретных классах).
  - [DONE] Диалекты: провайдеры реализуют `getDialect()`, `Queryable` передаёт диалект в `QueryBuilder`, дефолт `SQLiteDialect` задан в `DatabaseProvider` для стабов/тестов.
  - [DONE] Логгеры: добавлен `SqlLoggerFactory` в `DbContextOptions`, создание логгера по провайдеру.
  - [DONE] Кэши: `SqlCache` (в `QueryBuilder`), `CountCache` (в `Queryable`), `EntityCacheLike` (L2) — опциональные инъекции.
- ISP: разделить крупные интерфейсы (при необходимости выделить инспекторы схемы/DDL).
- SRP: вынести построение SQL/кэш/логирование в самостоятельные сервисы с чёткой ответственностью.
  - [DONE] Парсинг join-предиката: `JoinPredicateParser`.
  - [DONE] Применение глобальных фильтров: `GlobalFilterApplier`.
  - [DONE] DDL генерация (CREATE TABLE/INDEX) вынесена в стратегии на уровне провайдеров (SQLite/MySQL/MSSQL/Postgres).

### Фаза 3 — Паттерны (2–4 дня) — [ГОТОВО]
- Strategy: диалекты/политики кэша/ретраев — консолидация фабрики и конфигурации.
- Builder: билдеры для миграций/DDL с безопасной экранизацией.
- Decorator: логгеры/метрики — композиция поведений.
- Adapter: унификация результатов инспектора схем для разных СУБД.
- Composite: при необходимости для AST/QueryModel.

Итоги Фазы 3:
- Реализованы RetryPolicy стратегии: ExponentialBackoff, FixedInterval, NoRetry; инъекция через DbContextOptions.
- CompositeSqlLogger и CompositeSqlLoggerFactory; поддержка композиции в DbContext.
- DdlStrategy и DdlBuilder; вынесены стратегии для SQLite/MySQL/MSSQL/Postgres.
- DiffBasedMigration (Template Method) с хуками before/after для up/down и statements.
- MigrationBuilder: create/alter/drop column; create/drop index; add/drop FK; rename table/column.
- MigrationFileBuilder: генерация TS‑миграций из SchemaDiff (up/down) с корректной экранизацией.

### Фаза 4 — Тестирование (3–5 дней) — [ГОТОВО]
- Модульные: отрицательные и граничные сценарии; ошибки провайдеров; конкуренция транзакций.
- Property-based: сложные where/join/groupBy/having/subquery/union (инварианты).
- Интеграция: полный цикл миграций для всех провайдеров (env/Testcontainers), идемпотентность.
- (Опц) Mutation testing для predicate parser/SQL генерации.

### Фаза 5 — Производительность (2–3 дня) — [В ПРОЦЕССЕ]
- Профилирование горячих участков; оптимизация аллокаций и структур данных.
- Тюнинг кэшей (sqlGen/L2/count), контроль роста, метрики размера.
- Аларминг по SLO (p95/99, error rate, retries).

Прогресс Фазы 5:
- [ГОТОВО] Кэш предикатов (AST→SQL) для where (Queryable._predicateSqlCache) с FIFO-эвикцией.
- [ГОТОВО] Предкомпилированные regex и кэши парсинга selector/include/key.
- [ГОТОВО] Ускоренное формирование ключа count(): `_whereSignature` + копирование в clone().
- [ГОТОВО] Микро-бенч `npm run bench` (bench/quick.ts) с расчётом avg/p95/p99.
- [ГОТОВО] README: добавлен PromQL для p99 поверх существующего p95.
- [TODO] Метрики размеров/ёмкости кэшей и управление ростом.
- [TODO] Глубокое профилирование hot-paths (Queryable/QueryBuilder) и отчёт.
- [TODO] Аларминг по p95/p99, error rate, retries (пример правил Alertmanager).

### Фаза 6 — DX & Документация (1–2 дня)
- CONTRIBUTING/код-стайл/архитектурные гайдлайны.
- README/Guides: актуализация примеров; разделы миграций/диалектов/тест-матрицы.
- Typedoc: покрыть public API и примеры использования.

## План тестов (сценарии)
- Providers: подключение/таймауты/ретраи; транзакции; NULL/DEFAULT/PK/FK; ошибки констрейнтов.
- Query/AST: сложные комбинации where/join/include/paginate; distinct; unions; подзапросы.
- Миграции: CREATE/ALTER/ADD/DROP; rebuild для SQLite; индексы/unique/FK; down-гварды.
- Кэши: sqlGen/L2/count — хиты/промахи/инвалидации; транзакционные эффекты; метрика hit ratio.
- Метрики/логирование: labels, retry, exemplars, endpoint; корректность при ошибках.

## Риски и декомпозиция
- Не ломать public API без мажора — придерживаться semver.
- Дробные PR/коммиты по фазам, с тестами и обратной совместимостью.

## Следующие действия
- Фаза 5: добавить метрики размеров кэшей и лимиты/эвикцию; провести детальное профилирование.
- Фаза 5: подготовить примеры правил аларминга по p95/p99 и error rate.
- Выровнять линтер-правила тестов с production (подтверждено завершение Фазы 4).
- Актуализировать документацию: дописать раздел про кэши (стратегии, ключи, TTL) и бенчмарк.

## Политика линтинга для тестов
- Временно правила для `tests/**/*.ts` ослаблены через ESLint `overrides` (отключены строгие type-aware проверки: no-unsafe-*, require-await, ban-ts-comment и т.п.), чтобы ускорить рефакторинг ядра.
- Итоговая цель: тесты должны соответствовать тем же линтер-правилам, что и production-код (type-aware). На завершающем этапе плана ослабления будут удалены.
