# Package Decomposition - Revised Strategy

## Проблема полной декомпозиции
Циклические зависимости между types → utils → DatabaseProvider делают полную декомпозицию сложной.

## Новая стратегия: Step-by-step value delivery

### Phase 1: Dialects Extraction ✅ (PRIORITY)
**Цель**: Разделить SQL диалекты на независимые пакеты
**Ценность**: Пользователи смогут использовать только нужные диалекты

```
@ts-linq/dialect-postgres  # PostgreSQL SQL dialect
@ts-linq/dialect-mysql     # MySQL SQL dialect
@ts-linq/dialect-mssql     # MSSQL SQL dialect  
@ts-linq/dialect-sqlite    # SQLite SQL dialect
```

### Phase 2: Provider Renaming ✅ (PRIORITY)
**Цель**: Переименовать провайдеры в provider-* convention
**Ценность**: Консистентность именования

```
@ts-linq/sqlite   → @ts-linq/provider-sqlite
@ts-linq/postgres → @ts-linq/provider-postgres
@ts-linq/mysql    → @ts-linq/provider-mysql
@ts-linq/mssql    → @ts-linq/provider-mssql
```

### Phase 3: Core Slimming (LATER)
**Цель**: Постепенно извлекать из core в отдельные пакеты
**Подход**: Один пакет за раз, тестируя каждый

1. migrations → @ts-linq/migrations
2. context → @ts-linq/orm  
3. pagination utilities → @ts-linq/pagination
4. и т.д.

## Immediate Action Plan

1. ✅ Создать dialect-* packages
2. ✅ Извлечь диалекты из core/providers
3. ✅ Переименовать provider пакеты
4. ✅ Обновить все импорты
5. ✅ Тестирование

**Время**: 2-3 часа
**Риск**: Низкий (меньше breaking changes)
