# Constraints: UNIQUE, CHECK, and Foreign Keys

Этот гайд кратко описывает, как задавать ограничения на уровне метаданных и как они применяются по диалектам.

## Как задавать

- UNIQUE — через индекс с флагом `unique: true`.
- CHECK — через декларацию проверки.
- FK — через декораторы отношений (ManyToOne/OneToMany/OneToOne/ManyToMany).

Пример (упрощённо, декораторы вынесены в регистрацию метаданных):

```ts
import { MetadataStorage } from '../../src/metadata/MetadataStorage';

class Product {}
MetadataStorage.addEntity(Product, 'Products');
MetadataStorage.addColumn(Product, {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false
});
MetadataStorage.addPrimaryKey(Product, 'id');
MetadataStorage.addColumn(Product, {
  propertyName: 'name',
  columnName: 'name',
  type: 'TEXT',
  nullable: false
});
// UNIQUE(name)
MetadataStorage.addIndex(Product, { name: 'UQ_Products_name', columns: ['name'], unique: true });
// CHECK (length(name) > 0)
MetadataStorage.addCheck(Product, { name: 'CK_name_len', expression: 'length(name) > 0' });
```

## Поведение по диалектам

- PostgreSQL/MSSQL/MySQL
  - UNIQUE/CHECK создаются как ограничения через `ALTER TABLE ... ADD CONSTRAINT ...`.
  - Дроп — через `ALTER TABLE ... DROP CONSTRAINT ...` (в MySQL drop unique — `DROP INDEX`).
  - FK — `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` (+ on delete/update).

- SQLite
  - UNIQUE реализуется через `CREATE UNIQUE INDEX`.
  - CHECK после создания таблицы не добавляется/не удаляется — формируется коммент‑подсказка.
  - Для сложных изменений (ALTER/DROP/FK/RENAME) применяется стратегия rebuild:
    - создать `__new_<table>` с целевой схемой (inline FK/CHECK),
    - скопировать общие колонки,
    - `DROP TABLE` старой, переименовать новую,
    - пересоздать UNIQUE/индексы.

## Дифф и миграции

- CLI `diff`/`verify` учитывают UNIQUE/CHECK/FK. Ключ `--details` выводит expected/actual/diff.
- `MigrationSqlBuilder`:
  - Изменения колонок разделены на add/alter/drop.
  - Поддерживает UNIQUE/CHECK через эмиттеры диалектов.
  - Для SQLite выполняет rebuild при деструктивных изменениях, используя `finalSnapshot` в `TableDiff`.

## Рекомендации

- Для SQLite предпочитайте генерировать план через `ts-linq diff` — он создаст безопасную последовательность шагов с rebuild.
- Для сетевых БД (PG/MySQL/MSSQL) используйте обычные миграции — добавление/удаление ограничений выполняется через `ALTER TABLE`.

## Быстрые примеры CLI

```bash
# Дифф с подробностями
npx ts-node src/bin/ts-linq-cli.ts diff --json --details --provider=sqlite --conn=:memory:

# Применение плана с транзакцией (diff‑режим)
npx ts-node src/bin/ts-linq-cli.ts migrate --transaction --provider=sqlite --conn=:memory:
```
