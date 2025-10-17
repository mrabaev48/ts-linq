# Revised Decomposition Approach

## Проблема
DatabaseProvider имеет слишком много зависимостей для извлечения в отдельный пакет.

## Новая стратегия: Hybrid Architecture

### Foundational Layer (уже готов)
- ✅ `@ts-linq/types` - Pure types, zero dependencies

### Core Layer (остается в @ts-linq/core)
- DatabaseProvider base class
- MetadataStorage
- Core utilities

### Feature Layer (извлекаем и фиксим)
- `@ts-linq/query` - импортирует из types и core
- `@ts-linq/cache` - импортирует из types и core
- `@ts-linq/migrations` - импортирует из types и core
- `@ts-linq/orm` - импортирует из types и core

### Dialect Layer (уже готов)
- ✅ `@ts-linq/dialect-*` - SQL generation

### Provider Layer (уже готов)
- ✅ `@ts-linq/provider-*` - Database providers

## План действий
1. Обновить query package - исправить imports
2. Обновить cache package - исправить imports
3. Обновить migrations package - исправить imports
4. Обновить orm package - исправить imports
5. Собрать все пакеты
6. Обновить core для re-export

**Цель**: Работающие feature packages + modular dialects/providers
