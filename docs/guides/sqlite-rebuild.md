# SQLite: стратегия rebuild для ALTER/DROP

Этот гайд описывает, как фреймворк обрабатывает сложные DDL‑операции в SQLite, где многие ALTER‑операции недоступны напрямую.

## Кратко

- SQLite не поддерживает ALTER COLUMN (тип/nullable/default), DROP COLUMN и ряд операций с CHECK/FOREIGN KEY после создания.
- Для таких случаев применяется стратегия rebuild: создаётся временная таблица с целевой схемой, данные переносятся, старая таблица удаляется, временная переименовывается в оригинальную.

## Где это работает из коробки

- CLI diff генератор (`DiffMigrationGenerator`) автоматически применяет rebuild, когда:
  - Есть `DROP COLUMN` или `ALTER COLUMN` (тип/nullable/default),
  - Требуется изменять внешние ключи.
- При rebuild:
  - Временная таблица включает: колонки, PK, (для SQLite) inline‑FK и CHECK.
  - После переименования пересоздаются UNIQUE/индексы.

## Ограничения и поведение классов

- `MigrationSqlBuilder` (используется в `DiffBasedMigration`):
  - Обобщённый генератор DDL, делегирует синтаксису диалекта через эмиттеры.
  - Для SQLite операции, требующие rebuild, генерируют информативные комментарии (чтобы не вводить скрытую миграционную логику).
  - Рекомендуется применять CLI diff для автоматического rebuild в SQLite.

## Рекомендации к использованию

- Для production‑миграций под SQLite:
  1. Используйте `ts-linq diff` для получения плана SQL — он применит rebuild, где нужно.
  2. Либо применяйте миграции скриптом/раннером, используя шаги, сгенерированные CLI.
- В PG/MySQL/MSSQL ALTER/DROP выполняются напрямую и поддерживаются эмиттерами.

## Пример (упрощённо)

```
-- rebuild при изменении схемы T
CREATE TABLE IF NOT EXISTS __new_T (... целевая схема c inline FK/CHECK ...);
INSERT INTO __new_T (common_cols) SELECT common_cols FROM T;
DROP TABLE T;
ALTER TABLE __new_T RENAME TO T;
-- восстановление индексов/UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS UQ_T_name ON T (name);
CREATE INDEX IF NOT EXISTS IX_T_x ON T (x);
```

## Что дальше

- Планируется расширить `MigrationSqlBuilder` для автоматического включения rebuild‑последовательностей в SQLite, когда будет передаваться целевой снапшот таблицы в `TableDiff`.
