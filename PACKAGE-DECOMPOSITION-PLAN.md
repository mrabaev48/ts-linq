# Package Decomposition Plan - Monorepo Restructuring

## Цель
Разбить монолитный `@ts-linq/core` пакет на специализированные пакеты для:
- Лучшей модульности и tree-shaking
- Независимых версий компонентов  
- Упрощения поддержки и тестирования
- Возможности использовать только нужные части

## Текущая структура (12 пакетов)
```
packages/
├── core/                    # 10,753 строк - МОНОЛИТ
├── sqlite/postgres/mysql/mssql/  # Провайдеры
├── cli/
├── metrics-safe/
├── composite-sql-logger/
├── open-telemetry-sql-logger/
├── prometheus-sql-logger/
├── cache-redis/memcached/
```

## Целевая структура (25+ пакетов)

### Уровень 1: Core & Foundation
```
@ts-linq/core              # Модель метаданных, Stage-3 декораторы, типы
@ts-linq/ast               # AST запросов, парсер, спецификации
@ts-linq/types             # Общие типы без any
```

### Уровень 2: SQL Generation
```
@ts-linq/sql-visitor       # Visitor AST→SQL (базовые части)
@ts-linq/dialect-postgres  # PostgreSQL SQL dialect
@ts-linq/dialect-mysql     # MySQL SQL dialect  
@ts-linq/dialect-mssql     # MSSQL SQL dialect
@ts-linq/dialect-sqlite    # SQLite SQL dialect
```

### Уровень 3: Database Providers
```
@ts-linq/provider-postgres # pg драйвер адаптер
@ts-linq/provider-mysql    # mysql2 драйвер адаптер
@ts-linq/provider-mssql    # mssql драйвер адаптер
@ts-linq/provider-sqlite   # sqlite3 драйвер адаптер
```

### Уровень 4: ORM Features
```
@ts-linq/orm               # DbContext, DbSet<T>, change tracker
@ts-linq/migrations        # Diff, generator, runner, schema state
@ts-linq/pagination        # Keyset/offset pagination
@ts-linq/concurrency       # Optimistic concurrency (версии/xmin/rowversion)
@ts-linq/cache             # SQL/AST cache, L2 entity cache
```

### Уровень 5: Plugins & Extensions
```
@ts-linq/plugin-soft-delete    # Soft delete plugin
@ts-linq/plugin-multi-tenant   # Multi-tenancy plugin
@ts-linq/plugin-audit          # Audit logging plugin
```

### Уровень 6: Observability
```
@ts-linq/telemetry             # OpenTelemetry, логгер, метрики
@ts-linq/metrics-safe          # ✅ Уже существует
@ts-linq/prometheus-sql-logger # ✅ Уже существует
@ts-linq/open-telemetry-sql-logger # ✅ Уже существует
```

### Уровень 7: Tools & Integrations
```
@ts-linq/cli                   # ✅ Уже существует
@ts-linq/integration-nestjs    # NestJS модуль
@ts-linq/testkits              # Контрактные/интеграционные тесты
@ts-linq/examples              # Runnable samples
```

## Миграционный план

### Фаза 1: Подготовка (1-2 дня)
- [ ] Анализ зависимостей между модулями
- [ ] Создание пустых package.json для новых пакетов
- [ ] Настройка TypeScript project references
- [ ] Обновление turbo.json для новой структуры

### Фаза 2: Извлечение Foundation (2-3 дня)
- [ ] Извлечь типы → `@ts-linq/types`
- [ ] Извлечь декораторы и metadata → `@ts-linq/core` (slim)
- [ ] Извлечь AST и парсер → `@ts-linq/ast`

### Фаза 3: SQL Layer (3-4 дня)
- [ ] Извлечь SQL visitor → `@ts-linq/sql-visitor`
- [ ] Разделить диалекты → `@ts-linq/dialect-*`
- [ ] Обновить провайдеры → `@ts-linq/provider-*`

### Фаза 4: ORM Layer (3-4 дня)
- [ ] Извлечь DbContext/DbSet → `@ts-linq/orm`
- [ ] Извлечь миграции → `@ts-linq/migrations`
- [ ] Извлечь pagination → `@ts-linq/pagination`
- [ ] Извлечь concurrency → `@ts-linq/concurrency`
- [ ] Извлечь cache → `@ts-linq/cache`

### Фаза 5: Plugins & Extensions (2-3 дня)
- [ ] Создать plugin-soft-delete
- [ ] Создать plugin-multi-tenant  
- [ ] Создать plugin-audit
- [ ] Создать telemetry пакет

### Фаза 6: Integrations (1-2 дня)
- [ ] Создать integration-nestjs
- [ ] Создать testkits
- [ ] Переместить examples

### Фаза 7: Testing & Cleanup (2-3 дня)
- [ ] Обновить все импорты
- [ ] Запустить полный тест suite
- [ ] Обновить документацию
- [ ] Удалить старый core (если всё перенесено)

## Зависимости между пакетами

```
types (базовые типы)
  ↓
core (decorators, metadata) 
  ↓
ast (query AST)
  ↓
sql-visitor → dialect-* 
  ↓
provider-*
  ↓
orm (DbContext, DbSet)
  ↓
migrations, pagination, concurrency, cache
  ↓
plugins
  ↓
telemetry, cli, integrations
```

## Преимущества

✅ **Модульность**: Используй только то, что нужно  
✅ **Tree-shaking**: Лучшее удаление неиспользуемого кода  
✅ **Независимые версии**: Обновляй компоненты отдельно  
✅ **Ясность**: Каждый пакет с одной ответственностью  
✅ **Тестирование**: Легче изолировать и тестировать  

## Breaking Changes

⚠️ **Изменятся все импорты** для пользователей:

```typescript
// Было
import { DbContext, Entity, Column } from '@ts-linq/core';

// Станет
import { Entity, Column } from '@ts-linq/core';
import { DbContext, DbSet } from '@ts-linq/orm';
```

## Совместимость

Опция: создать `@ts-linq/all` или `@ts-linq/bundle` для обратной совместимости:

```typescript
// @ts-linq/all - re-exports всё из других пакетов
export * from '@ts-linq/core';
export * from '@ts-linq/orm';
export * from '@ts-linq/migrations';
// ...
```

## Оценка времени

**Общая продолжительность**: 14-21 день (3-4 недели)  
**Риски**: Высокий - много breaking changes  
**Приоритет**: P1 - нужно для v2.0
