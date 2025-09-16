# ts-linq CLI: Detailed Plan

## Цели
- Полноценный CLI для управления жизненным циклом БД и миграций:
  - init/config, generate (entity/migration), diff, migrate/rollback, seed, status, verify
  - единый UX для SQLite/Postgres/MySQL/MSSQL
  - безопасность: dry-run, транзакции, блокировки, проверки

## Принципы качества и архитектуры (обязательно)
- Соблюдение Clean Code:
  - осмысленные имена (без однобуквенных/абстрактных сокращений), короткие функции, явные ошибки
  - отсутствие дублирования, предпочтение явных параметров над глобальным состоянием
  - предсказуемые побочные эффекты, чистые функции там, где возможно
- SOLID:
  - SRP: каждая команда/хендлер решает одну задачу (парсинг, выполнение, вывод)
  - OCP: добавление новой подкоманды без изменения существующих (реестр команд)
  - LSP/ISP: узкие интерфейсы провайдеров/раннеров, совместимость реализаций
  - DIP: зависимости через абстракции (интерфейсы провайдера/логгера), внедрение через фабрики
- Паттерны проектирования и ООП:
  - Command для подкоманд CLI (реестр команд → хендлеры)
  - Strategy для провайдеров БД и диалектов SQL
  - Factory/Abstract Factory для логгеров/провайдеров из конфига
  - Template Method в раннере миграций (транзакции/квитирование истории)
  - Adapter для сторонних клиентов (prom-client) и конфигов среды
- Нефункциональные требования:
  - тестируемость (инъекция зависимостей, заглушки провайдера), детерминированные юнит-тесты
  - читаемость и поддерживаемость (модульные границы, низкая связность, высокая когезия)
  - строгость типов (без any; явные типы входов/выходов публичных API)
  - обязательные unit‑тесты для SQL‑эмиттеров (диалектная логика): при добавлении/изменении эмиттеров покрывать как минимум q(), dropIndex(), createTable(), addColumn(), dropColumn(), alterType(), alterNull(), formatValue(), mapType()/mapTypeWithModifiers(), включая edge‑cases

## Область
- Первая итерация фокусируется на миграциях/схеме; затем генерация кода и удобства разработчика.

## Команды (v1)
- cli init
  - создаёт базовый конфиг `tslinq.config.{ts,js,json}` и папки `migrations/`, `seeds/`
- cli config [print]
  - выводит эффективную конфигурацию (resolve env)
- cli diff [--provider p] [--conn url] [--out file.sql] [--create]
  - вычисляет SQL-дифф схемы (метадата → БД); `--create` печатает scaffold для миграции
- cli migrate [--to <version>] [--step N] [--conn url] [--provider p] [--dry-run] [--verbose]
  - применяет миграции вперёд; `--dry-run` печатает SQL без выполнения
- cli rollback [--to <version>] [--step N] [--conn url] [--dry-run]
  - откатывает миграции назад через `down()`
- cli generate migration <Name> [--dir migrations/]
  - создаёт файл миграции с таймстемпом и шаблоном `up/down`
- cli generate entity <Name> [--dir src/entities]
  - генерирует класс с декораторами и базовой схемой
- cli seed [--file seeds.sql|.ts] [--conn url]
  - применяет sql или ts-скрипт сидирования
- cli status [--json]
  - показывает историю миграций: применено/ожидает; текущая версия; pending
- cli verify
  - сверяет контрольные суммы миграций (защита от дрейфа)

## Конфигурация
- Файл `tslinq.config.ts|js|json`:
  - provider: sqlite|postgresql|mysql|mssql
  - connectionString: string (или резолв из `process.env`)
  - migrationsDir: string (default `migrations`)
  - seedsDir: string (default `seeds`)
  - entitiesGlobs: string[] (автоподгрузка декорированных сущностей)
  - metrics: { enabled?: boolean }
- Порядок резолва: CLI flags > env > config file > defaults

## Архитектура CLI
- Бинарь: `src/bin/ts-linq-cli.ts` с подкомандами (без тяжёлых зависимостей)
- `CliRuntime`:
  - загрузка конфига, env, автозагрузка сущностей (по globs)
  - конструирование `DbContext`/провайдера (или прямой провайдер для низкого уровня)
- Роутер команд (таблица subcommand → handler)

## Слой миграций
- Таблица истории: `_Migrations` (id PK, version, name, appliedAt, checksum)
- Применение миграций:
  - сортировка по версии (timestamp)
  - транзакции, запись в историю, проверка checksum
  - `down()` в обратном порядке при rollback
- Проверка дрейфа (`verify`): несоответствие checksum → ошибка

## Diff-движок
- Уже есть: SQLite diff (create/add/rebuild)
- Расширения:
  - Postgres/MySQL/MSSQL: безопасные ALTER (тип/nullable), индексы, FK, unique
  - Генерация миграции из диффа: scaffold в `migrations/<ts>_Diff.ts` с SQL/шагами
  - Гварды: `IF EXISTS/IF NOT EXISTS`, идемпотентность

## Генерация кода (v2)
- generate entity <Name>:
  - шаблон класса с `@Entity`, `@PrimaryKey`, `@Column`, пример FK/relations
  - флаги: `--dir`, `--pk`, `--columns name:string,age:number,active:boolean?`
- generate migration <Name>:
  - JSDoc и TODO-заглушки; опции `--sql up.sql --down down.sql`

## Безопасность и UX
- Dry-run для всех команд
- Подтверждение перед DDL в проде (`--yes` для CI)
- Логи: `--verbose` (SQL+тайминги), `--quiet`
- Блокировка: advisory lock/табличные lock-и (на уровне провайдера)
- Таймауты/ретраи: использовать политику провайдера

## Метрики и трассировка
- Интеграция PrometheusSqlLogger/OpenTelemetrySqlLogger через конфиг
- Метрики команд: `cli_command_total`, `cli_command_duration_ms`

## Тестирование
- Юнит: парсинг конфига, генерация имён, формат путей
- Интеграция (SQLite in-memory):
  - migrate → status → rollback → verify → seed
  - diff → scaffold → migrate
- Снэпшоты для сгенерированных файлов миграций

## Документация
- README: раздел "CLI"
- Отдельная страница: синтаксис команд, примеры
- FAQ: частые проблемы (лок, дрейф, привилегии DDL)

## Пакетирование
- Добавить `bin` в package.json: `"ts-linq": "dist/cjs/bin/ts-linq-cli.js"`
- Компиляция bin в CJS; shebang сохранять

## Дорожная карта (итерации)
1) v0.1: migrate/apply-diff, status, generate migration, seed, config print
2) v0.2: init, verify, rollback (только явные миграции), dry-run/verbose/quiet, exit codes
2.1) v0.2.1: рефакторинг CLI (Clean Code / SOLID)
3) v0.3: diff scaffold в файл, Postgres/MySQL/MSSQL частичная поддержка diff
4) v0.4: generate entity, advisory locks, checksum-хранилище
5) v1.0: кросс-СУБД миграции, стабильные интерфейсы, документация

## Критерии приёмки (v0.2)
- Команды отрабатывают с корректными exit code
- История миграций отражается в `status`
- `verify` ломается при изменении содержимого миграции
- `migrate --dry-run` не меняет БД, но печатает SQL
- README/доки покрывают установку и примеры

## Открытые вопросы
- Унификация SQL для сложных ALTER (возможно, оставить за ручными миграциями)
- Автогенерация миграций из метадаты vs ручные миграции
- Версионирование файла конфига

## Разбиение на задачи (детально)

### Итерация v0.1 — каркас и базовые команды
- [x] Инициализация каркаса CLI
  - [x] Лёгкий парсер аргументов
  - [x] Общие флаги: `--conn`, `--provider`, `--verbose`, `--quiet`, `--json`, `--dry-run`, `--cwd`
  - [x] Вывод `--help`, `--version`
- [x] Загрузчик конфигурации
  - [x] Поддержка `tslinq.config.ts|js|cjs|mjs|json`
  - [x] Резолв путей относительно файла конфига и/или `--cwd`
  - [x] Слияние источников: CLI > env > файл > defaults
  - [x] Минимальная валидация
- [x] Автозагрузка сущностей
  - [x] Поддержка `entitiesGlobs` (+ ts-node/register/transpile-only)
  - [x] Bootstrap-скрипты
  - [x] Singleton `MetadataStorage`
- [x] Команда `generate migration <Name>`
  - [x] Шаблон файла в `migrations/<ts>_<Name>.ts` с `up/down`
  - [x] Параметры: `--dir`
- [x] Команда `seed`
  - [x] Поддержка `.sql` (много операторов через `;`)
  - [ ] Поддержка `.ts` (экспорт `async run(provider)`) — запланировано
- [x] Команда `status`
  - [x] Инициализация таблицы истории при отсутствии
  - [x] Вывод применённых/ожидающих миграций (JSON/текст)
- [x] Команда `migrate`
  - [x] Применение непроведённых миграций, транзакция, запись в историю
  - [x] Опции: `--step`, `--to`, `--dry-run`, `--json`, `--verbose/--quiet`
- [x] Интеграционные тесты (SQLite in-memory)

### Итерация v0.2 — откаты, verify, UX/exit-codes
- [x] Команда `rollback` (базовая)
- [ ] Команда `verify`
- [ ] Стандартизировать коды выхода
- [ ] Негативные сценарии и UX (CI, цвета, подсказки)

### Итерация v0.3 — diff/scaffold и поддержка нескольких СУБД
- [x] Команда `diff` (+ `--json`, `--out`, `--create`, `--name`, `--details`)
- [x] Scaffold миграции из диффа (`migrations/<ts>_Diff.ts`)
- [x] Расширение `SchemaInspector`/`DiffMigrationGenerator` (Pg/MySQL/MSSQL/SQLite):
  - [x] Columns: type/null/default/length/precision/scale
  - [x] Indexes: create/drop, expression/partial (PG), нормализация
  - [x] Foreign keys: create/drop, ON DELETE/UPDATE, composite
  - [x] Unique constraints: PG/MySQL/MSSQL; для SQLite через UNIQUE INDEX
  - [x] Check constraints: PG/MSSQL; нормализация выражений
  - [x] Defaults: нормализация функций/литералов (время/UUID/nextval)
  - [x] Rename columns: эвристика drop+add → rename (PG/MySQL/MSSQL)
  - [x] CLI `diff --json --details`: вывод expected/actual/diff

### Итерация v0.4 — генерация сущностей, блокировки и хранилище checksum
- [x] Команда `generate entity <Name>` (флаги `--dir`, `--pk`, `--columns`)
- [x] Блокировки при `migrate` (Pg/MSSQL/MySQL) — advisory locks + тесты
- [x] Хранилище checksum — файл‑базлайн и `verify --db` (`__migration_checksums`) + тесты

### Итерация v1.0 — полировка, документация, стабильный контракт
- [ ] Полная документация CLI в README и docs/
- [ ] Стабилизация интерфейсов, deprecation policy
- [ ] Примеры и рецепты (prod-safe pipeline, CI)

## Спецификации команд (подробно)

### Общие
- Глобальные флаги: `--config <path>`, `--conn <url>`, `--provider <id>`, `--cwd <dir>`, `--json`, `--dry-run`, `--verbose`, `--quiet`, `--yes`
- Коды выхода:
  - 0: успех
  - 1: внутренняя ошибка выполнения/SQL
  - 2: ошибка ввода/валидации/неверные аргументы
  - 3: обнаружен дрейф миграций (`verify`)
  - 4: не удалось захватить блокировку (concurrency)
  - 5: ошибка подключения к БД

### init
- Назначение: быстрый старт проекта
- Действия: создать `tslinq.config.ts` (или формат по флагу), папки `migrations/`, `seeds/`, пример миграции/сидов
- Флаги: `--format ts|js|json`, `--force`, `--dir <root>`
- Выход: пути созданных файлов, рекомендации

### config [print]
- Назначение: отладка конфигурации
- Действия: загрузить и распечатать effective-config (с учётом env и флагов)
- Флаги: `--json`

### generate migration <Name>
- Назначение: scaffold новой миграции
- Действия: создать файл `migrations/<ts>_<Name>.ts` с заготовками `up/down`
- Флаги: `--dir`, `--prefix`, `--language ts|js`
- Exit codes: 0/2

### generate entity <Name>
- Назначение: scaffold сущности с декораторами
- Флаги: `--dir`, `--pk id|uuid`, `--columns name:string,age:number,...`

### status
- Назначение: показать состояние истории
- Действия: ensure history table → собрать список применённых и pending, текущая версия
- Флаги: `--json`, `--limit N`

### migrate
- Назначение: применить миграции вперёд
- Действия: загрузить файлы → вычислить pending → сортировать → применить в транзакции
- Флаги: `--to <version>`, `--step N`, `--dry-run`, `--json`, `--yes`, `--transaction`
- Пред-/пост-условия: наличие таблицы истории; при dry-run БД не меняется

### rollback
- Назначение: откатить миграции назад
- Действия: определить целевой диапазон → вызывать `down()` в обратном порядке, запись в историю
- Флаги: `--to <version>`, `--step N`, `--dry-run`, `--json`, `--yes`

### diff
- Назначение: вывести SQL отличий между метаданными и текущей БД
- Действия: подключиться к БД → собрать snapshot → сравнить → построить шаги SQL
- Флаги: `--out file.sql`, `--create`, `--name ClassName` (имя класса/файла scaffold), `--json`, `--details`

### seed
- Назначение: применить сиды
- Действия: если .sql — split по `;`; если .ts — `export async function run(provider){}`
- Флаги: `--file`, `--dir`, `--yes`, `--transaction`, `--json`

### verify
- Назначение: убедиться, что содержимое файлов миграций не изменилось
- Действия: рассчитать checksum каждого файла, сравнить с сохранённой в истории
- Флаги: `--json`

## Конфиг и загрузка окружения
- Поля:
  - `provider: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'`
  - `connectionString: string | { env: string }`
  - `migrationsDir?: string` (default `migrations`)
  - `seedsDir?: string` (default `seeds`)
  - `entitiesGlobs?: string[]`
  - `metrics?: { enabled?: boolean }`
- Резолв env: `{ env: 'POSTGRES_URL' }` → `process.env.POSTGRES_URL`
- Резолв путей: относительные → относительно файла конфига, если задан, иначе CWD
- Обработка `.ts` конфига: динамический `ts-node/register/transpile-only`

## История миграций (таблица)
- Имя: `_migrations`
- Колонки:
  - `version TEXT PRIMARY KEY` (например, `YYYYMMDDHHmmss`)
  - `name TEXT NOT NULL`
  - `checksum TEXT NOT NULL`
  - `applied_at DATETIME NOT NULL`
- Индексы: PK по `version`
- Инициализация: `CREATE TABLE IF NOT EXISTS ...`

## Блокировки и конкуренция
- SQLite: транзакция достаточна
- Postgres: advisory lock `pg_try_advisory_lock(hash(namespace))`
- MySQL/MariaDB: `GET_LOCK(name, timeout)` и `RELEASE_LOCK`
- MSSQL: `sp_getapplock`/`sp_releaseapplock`
- Поведение при невозможности захвата: exit 4

## Dry-run и режимы вывода
- `--dry-run`: выполняется полный план без `executeNonQuery`; SQL печатается/возвращается
- `--json`: машинный вывод объектов (команды, шаги, результаты)
- `--quiet`: подавляет информативные логи, оставляет ошибки/итоги
- `--verbose`: включает SQL и тайминги

## Ошибки и сообщения
- Единый формат ошибок: код, краткое сообщение, подсказка (hint), возможные действия
- Распознавание типовых ошибок: нет подключения, права на DDL, конфликт блокировки, дрейф

## Тест-план (детально)
- Юнит-тесты
  - Парсинг аргументов и приоритетов (CLI/env/config)
  - Резолв конфигов и путей
  - Генерация имён файлов миграций
  - Проверка схемы истории (DDL)
- Интеграционные тесты (SQLite)
  - init → generate migration → migrate → status → verify → rollback → status
  - seed `.sql` и seed `.ts`
  - diff → scaffold → migrate (применяется одна и та же схема)
- Снэпшоты
  - Шаблоны миграций/сущностей
  - JSON-вывод `status`, `diff --json`

## Пакетирование и дистрибуция
- Добавить в `package.json`:
  - `bin: { "ts-linq": "dist/cjs/bin/ts-linq-cli.js" }`
  - Скрипт `build:bin` (компиляция CJS для bin, сохранение shebang)
- Проверка запуска: `npx ts-linq --help`

## Риски и смягчение
- Сложные ALTER: минимальная поддержка + явные миграции вручную
- Конфликты автозагрузки сущностей: изоляция процесса, очистка MetadataStorage между запусками
- Кросс-СУБД различия: узкий контракт diff-движка, расширять по мере готовности

## Оценка объёма (грубо)
- v0.1: 2–3 дня
- v0.2: 2 дня
- v0.3: 3–4 дня (зависит от поддержки СУБД)
- v0.4: 2–3 дня
- v1.0 (полировка/доки): 1–2 дня

## Следующие шаги (конкретные)
- [x] Встроить командный роутер и глобальные флаги в `src/bin/ts-linq-cli.ts`
- [x] Реализовать загрузчик конфига и автозагрузку сущностей (с unit-тестами)
- [x] Переписать существующие `generate/seed/status/migrate` на новый каркас
- Разделение на подзадачи:
  - [x] Добавить `rollback`
  - [ ] Добавить `verify`
  - [ ] Стандартизировать коды выхода
- [x] Реализовать `diff` (+ scaffold миграции из диффа)
- [ ] Подключить метрики/трассировку (опционально, через конфиг)
- [ ] Обновить README и добавить раздел CLI в документацию

### Итерация v0.2.1 — рефакторинг CLI (Clean Code / SOLID)
- Цели:
  - Повысить читаемость и расширяемость CLI, снизить связность и дублирование
  - Ввести чёткие границы модулей и зависимостей (DIP), единый стиль ошибок/вывода
- Архитектурные изменения:
  - Структура `src/cli/`:
    - `commands/` — по одному файлу на команду (status, diff, migrate, rollback, config, generate, seed, init, verify)
    - `runtime/` — `CliContext` (config/env/cwd), загрузка bootstrap/entities
    - `parser/` — разбор и валидация флагов
    - `ports/` — абстракции над окружением: `FsPort`, `ProcessPort`, `ChecksumPort`, `CliLogger`
  - Паттерн Command: реестр `Record<string, CommandHandler>` вместо `switch` (OCP)
  - DIP: хендлеры зависят от портов/фабрик, а не от Node API напрямую
  - Единый формат результата команды: `CliResult { code: number; json?: unknown }`
  - Централизованный маппинг ошибок → exit codes; единый формат сообщений/JSON
- Правила качества:
  - Функции до 20–30 строк, говорящие имена, отсутствие дублирования
  - Явная типизация флагов/конфига, без any
  - Логи через `CliLogger` с уровнями (quiet/verbose)
- План работ (шаги):
  1) [x] Вынести `parseArgs`, `makeEffectiveConfig`, `loadBootstrapFiles`, `loadEntitiesFromGlobs` в `src/cli/runtime/*`
  2) [x] Ввести `Command`/`CommandRegistry`; перенести `status`, `config`, `diff` в `src/cli/commands/*`
  3) [x] Перенести `migrate`, `rollback`; подключить через реестр
  4) [x] Добавить порты `FsPort`, `ProcessPort`, `ChecksumPort`, `CliLogger` и Node‑адаптеры
  5) [x] Централизовать обработку ошибок/exit codes в `bin` (JSON при --json)
  6) [x] Юнит‑тесты на runtime/команды (моки/адаптеры портов) + e2e
  7) [ ] Доки по архитектуре CLI и Dev‑гайд по добавлению команд
     - [ ] CLI_ARCHITECTURE.md
     - [ ] CLI_DEV_GUIDE.md

### Итерация v0.3.1 — полировка diff/нормализации
- [x] Нормализация DEFAULT по диалектам (временные функции/UUID/nextval/булевы)
- [x] Нормализация CHECK выражений (касты/кавычки/скобки)
- [x] Нормализация индексных выражений/WHERE/колонок
- [x] Корректные DROP INDEX для диалектов
- [x] MySQL CHANGE COLUMN с точным типом при rename

