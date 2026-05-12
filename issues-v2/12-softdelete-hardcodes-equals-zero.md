# Issue #12 — Soft-Delete Хардкодит `= 0` — Сломано для PostgreSQL

**Severity:** Medium  
**Status:** Остаётся  
**Affected files:**
- `packages/query/src/GlobalFilterApplier.ts` (строка 22)

---

## Описание проблемы

```ts
// packages/query/src/GlobalFilterApplier.ts:16-24
if (softDeleteOptions?.enabled) {
  const flagPropOrCol = softDeleteOptions.column ?? 'isDeleted';
  const col = selfMeta.columns.find(
    (c) => c.propertyName === flagPropOrCol || c.columnName === flagPropOrCol
  );
  if (col) {
    model.where.push({ condition: `${col.columnName} = 0`, parameters: [] });
    //                                               ^^^ хардкод!
  }
}
```

## Почему `= 0` сломано для PostgreSQL

В PostgreSQL столбцы типа `BOOLEAN` хранят `true`/`false`, не `1`/`0`.

```sql
-- SQLite/MySQL: работает
SELECT * FROM users WHERE is_deleted = 0

-- PostgreSQL: ОШИБКА
SELECT * FROM users WHERE is_deleted = 0
-- ERROR: operator does not exist: boolean = integer
-- HINT: No operator matches the given name and argument types...
```

## Предлагаемое решение

### Вариант A: Параметризованный запрос с `false`

```ts
model.where.push({ condition: `${col.columnName} = ?`, parameters: [false] });
```

Провайдер PostgreSQL при подстановке параметра `false` правильно передаёт его как `boolean`.
Провайдер SQLite/MySQL получит `0` или `false` в зависимости от драйвера (оба работают).

### Вариант B: Диалект-специфичное значение

```ts
export class GlobalFilterApplier {
  public apply(
    entityClass: Function,
    model: { where?: WhereClause[] },
    softDeleteOptions: SoftDeleteOptions | undefined,
    globalFilters?: GlobalFilter[],
    dialect?: SqlDialect  // ← добавить параметр
  ): void {
    ...
    const boolFalseValue = dialect?.boolFalseLiteral?.() ?? '0';
    model.where.push({ condition: `${col.columnName} = ${boolFalseValue}`, parameters: [] });
  }
}
```

Параметризованный вариант (A) проще и не требует изменения интерфейса.
