# Test matrix (скелет)

Цель: запуск интеграционных тестов для всех провайдеров (SQLite/PostgreSQL/MySQL/MSSQL) локально и в CI.

## Переменные окружения

- POSTGRES_URL — включает Postgres‑тесты
- MYSQL_URL — включает MySQL‑тесты
- MSSQL_URL — включает MSSQL‑тесты

При отсутствии переменных соответствующие сьюты пропускаются.

## Быстрый старт с Docker (локально)

PostgreSQL:

```bash
docker run -d --rm -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=ts_linq \
  --name pg16 postgres:16
export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/ts_linq
npm test
```

MySQL:

```bash
docker run -d --rm -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=ts_linq \
  --name mysql8 mysql:8.0
export MYSQL_URL=mysql://root:password@localhost:3306/ts_linq
npm test
```

MSSQL:

```bash
docker run -d --rm -p 1433:1433 \
  -e ACCEPT_EULA=Y -e SA_PASSWORD='Your_password123' \
  --name mssql2022 mcr.microsoft.com/mssql/server:2022-latest
export MSSQL_URL='Server=localhost;Database=ts_linq;User Id=sa;Password=Your_password123;Encrypt=false'
npm test
```

## Testcontainers (план)

- Добавить Testcontainers‑обёртки для поднятия БД в тестах.
- Гейт по env‑флагу USE_TESTCONTAINERS=1, чтобы локально можно было использовать уже поднятые контейнеры.
- В CI: матрица job’ов по провайдерам с кэшем образов.

## Рекомендации

- Выделить теги/группы тестов для интеграции, чтобы запускать их избирательно.
- Логи БД — выставлять минимальный уровень, чтобы не шумели в CI.
- Таймауты — чуть выше дефолта Jest для сетевых БД (например, 15–30s на сьют).
