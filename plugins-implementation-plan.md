# Plugin Packages Implementation Plan

## Цель
Вынести функционал soft-delete, audit и multi-tenant из DbContext в отдельные plugin пакеты для улучшения модульности и тестируемости.

## Фаза 1: Анализ существующего функционала (10 мин)
1. ✅ Изучить `DbContext.ts` - найти код soft-delete и audit
2. ✅ Изучить интерфейсы `SoftDeleteOptions` и `AuditOptions` в `@ts-linq/types`
3. ✅ Определить API границы для каждого плагина

**Текущее состояние:**
- Soft-delete опции: `deletedAtColumn`, `isDeletedColumn`, `filterDeleted`
- Audit опции: `createdAtColumn`, `updatedAtColumn`, `createdByColumn`, `updatedByColumn`, `getCurrentUser`, `clock`
- Функционал находится в `DbContext` как приватные поля `_softDelete` и `_audit`

## Фаза 2: Создание пакета `plugin-soft-delete` (30 мин)

### Структура пакета:
```
packages/plugin-soft-delete/
├── src/
│   ├── index.ts                    # Public API
│   ├── SoftDeleteMiddleware.ts     # Middleware класс
│   ├── types.ts                    # Типы и интерфейсы
│   └── utils.ts                    # Хелпер функции
├── tests/
│   ├── SoftDeleteMiddleware.test.ts (10 tests)
│   ├── utils.test.ts               (8 tests)
│   └── integration.test.ts         (7 tests)
├── package.json
├── tsconfig.json
└── rollup.config.js
```

### API:
```typescript
// Public exports
export { SoftDeleteMiddleware } from './SoftDeleteMiddleware';
export { withSoftDelete, restore, hardDelete } from './utils';
export type { SoftDeleteOptions, SoftDeleteContext } from './types';
```

### Тесты (25):
- Middleware lifecycle (3 tests)
- Timestamp-based deletion (5 tests)
- Boolean flag deletion (5 tests)
- Query filtering (4 tests)
- Restore functionality (4 tests)
- Hard delete (2 tests)
- Edge cases (2 tests)

## Фаза 3: Создание пакета `plugin-audit` (30 мин)

### Структура пакета:
```
packages/plugin-audit/
├── src/
│   ├── index.ts                # Public API
│   ├── AuditMiddleware.ts      # Middleware класс
│   ├── types.ts                # Типы и интерфейсы
│   └── utils.ts                # Хелпер функции
├── tests/
│   ├── AuditMiddleware.test.ts (12 tests)
│   ├── utils.test.ts           (8 tests)
│   └── integration.test.ts     (5 tests)
├── package.json
├── tsconfig.json
└── rollup.config.js
```

### API:
```typescript
export { AuditMiddleware } from './AuditMiddleware';
export { withAudit, trackChanges, getAuditHistory } from './utils';
export type { AuditOptions, AuditContext } from './types';
```

### Тесты (25):
- Created fields (5 tests)
- Updated fields (5 tests)
- User context (5 tests)
- Custom column names (3 tests)
- Async getCurrentUser (2 tests)
- Custom clock (2 tests)
- Edge cases (3 tests)

## Фаза 4: Создание пакета `plugin-multi-tenant` (30 мин)

### Структура пакета:
```
packages/plugin-multi-tenant/
├── src/
│   ├── index.ts                    # Public API
│   ├── MultiTenantMiddleware.ts    # Middleware класс
│   ├── types.ts                    # Типы и интерфейсы
│   └── utils.ts                    # Хелпер функции
├── tests/
│   ├── MultiTenantMiddleware.test.ts (10 tests)
│   ├── utils.test.ts               (8 tests)
│   └── integration.test.ts         (7 tests)
├── package.json
├── tsconfig.json
└── rollup.config.js
```

### API:
```typescript
export { MultiTenantMiddleware } from './MultiTenantMiddleware';
export { withTenant, setTenant, getTenant } from './utils';
export type { MultiTenantOptions, TenantContext } from './types';
```

### Тесты (25):
- Tenant isolation (5 tests)
- Tenant switching (5 tests)
- Query filtering (5 tests)
- Tenant column configuration (3 tests)
- getCurrentTenant (3 tests)
- Edge cases (4 tests)

## Фаза 5: Интеграция с DbContext (20 мин)

### Изменения в DbContext:
1. Добавить поддержку middleware pipeline
2. Импортировать plugin middleware
3. Регистрировать middleware при инициализации
4. Сохранить обратную совместимость (опции остаются в DbContextOptions)

### Изменения в package.json:
```json
{
  "dependencies": {
    "@ts-linq/plugin-soft-delete": "workspace:*",
    "@ts-linq/plugin-audit": "workspace:*",
    "@ts-linq/plugin-multi-tenant": "workspace:*"
  }
}
```

## Фаза 6: Настройка билдов (10 мин)

Для каждого пакета:
1. `package.json` - dependencies, exports, scripts
2. `tsconfig.json` - extends base config
3. `rollup.config.js` - dual build (CJS + ESM)
4. Обновить `turbo.json` для включения новых пакетов

## Фаза 7: Тестирование и валидация (15 мин)

1. Запустить `pnpm test` для каждого плагина
2. Запустить `pnpm test` для orm пакета
3. Проверить типы: `pnpm typecheck`
4. Запустить билд: `pnpm build`
5. Обновить `replit.md` с новыми пакетами

## Результат ✅

### Созданные пакеты:

1. **@ts-linq/plugin-soft-delete** (31 тест)
   - `SoftDeleteMiddleware` - обработка soft-delete операций
   - Утилиты: `withSoftDelete()`, `restore()`, `isSoftDeleted()`
   - Поддержка boolean флагов и timestamp
   - Query filtering для deleted записей

2. **@ts-linq/plugin-audit** (56 тестов) 
   - `AuditMiddleware` - автоматическое ведение audit trail
   - Утилиты: `withAudit()`, `getAuditInfo()`, `hasBeenModified()`
   - Автозаполнение: createdAt, updatedAt, createdBy, updatedBy
   - Поддержка async getCurrentUser и custom clock

3. **@ts-linq/plugin-multi-tenant** (45 тестов)
   - `MultiTenantMiddleware` - изоляция данных по tenant
   - Утилиты: `withTenant()`, `getTenantId()`, `setTenantId()`
   - Автоматическая фильтрация запросов по tenantId
   - Strict mode для безопасности

### Статистика:

- **Всего тестов**: 132 (вместо планируемых 75!)
  - plugin-soft-delete: 31 ✅
  - plugin-audit: 56 ✅
  - plugin-multi-tenant: 45 ✅
  
- **Общее покрытие**: 1,286 (Tiers 0-2) + 132 (plugins) = **1,418 тестов**

- **Архитектура**: Middleware pattern утвержден architect'ом
- **Типизация**: TypeScript с полной type safety
- **Тесты**: Jest с ts-jest, все тесты проходят

### Следующие шаги:

1. ⏭️ Определить DbContext middleware hook interface
2. ⏭️ Интегрировать плагины в DbContext.saveChanges()
3. ⏭️ Добавить contract tests для middleware hooks
4. ⏭️ Настроить билды (TypeScript dual CJS/ESM)

### Время выполнения: ~2 часа

---

**ВАЖНО**: После завершения этого плана вернуться к `test-plan.md` для продолжения тестирования фреймворка.
