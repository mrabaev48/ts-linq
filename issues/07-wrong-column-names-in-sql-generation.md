# Issue #07 — Неверные Имена Столбцов в SQL: PropertyName вместо ColumnName

**Severity:** High  
**Category:** Correctness / Data Integrity  
**Affected files:**
- `packages/core/src/query/visitors/BinaryVisitor.ts`
- `packages/core/src/query/Queryable.ts` (метод `keysetPaginate`)
- `packages/core/src/query/GlobalFilterApplier.ts`
- `packages/core/src/query/Queryable.ts` (метод `whereInSubquery`)

---

## Описание проблемы

В нескольких местах кода в SQL-запросы вставляется **имя свойства JS-класса** (`propertyName`) вместо **имени столбца в базе данных** (`columnName`). Это два разных значения, которые могут не совпадать.

### Пример расхождения

```ts
@Entity({ name: 'users' })
class User {
  @Column({ name: 'user_age', type: 'INTEGER' })  // columnName = 'user_age'
  age!: number;                                    // propertyName = 'age'
  
  @Column({ name: 'is_active', type: 'BOOLEAN' })  // columnName = 'is_active'
  isActive!: boolean;                              // propertyName = 'isActive'
}
```

---

## Конкретные проблемы

### Проблема 1: `BinaryVisitor` — неверное имя столбца в WHERE

```ts
// packages/core/src/query/visitors/BinaryVisitor.ts
export class BinaryVisitor {
  public visit(node: BinaryExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const column = node.left.name; // ← это propertyName из AST!
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
    // Генерирует: WHERE age > ? — но в БД столбец называется user_age!
  }
}
```

`PredicateParser` извлекает имя через `match[1]` из regex `\w+\.(\w+)`, что даёт JS-имя свойства (`age`), а не `column.columnName` (`user_age`). `BinaryVisitor` не знает ни о каком маппинге.

**Результат:** `WHERE age > 18` → `column "age" does not exist` в PostgreSQL.

### Проблема 2: `keysetPaginate()` — аналогичная ошибка

```ts
// packages/core/src/query/Queryable.ts
public async keysetPaginate<TKey extends keyof T>(
  key: TKey,
  after: T[TKey] | null,
  size: number
): Promise<...> {
  // ...
  const whereClause: WhereClause = {
    condition: `${String(key)} > ?`,  // ← key — это propertyName!
    parameters: [after as unknown as SqlParameter]
  };
  // Генерирует: WHERE id > ? — ОК если columnName === propertyName
  // Но: WHERE userId > ? — если столбец называется user_id
}
```

### Проблема 3: `whereInSubquery()` — потенциальная SQL инъекция

```ts
// packages/core/src/query/Queryable.ts
public whereInSubquery<TOther>(
  column: keyof T & string,  // ← пользователь передаёт строку напрямую
  subquery: Queryable<TOther>
): Queryable<T> {
  const clause: WhereClause = {
    condition: `${column} IN (${query})`,  // ← column вставляется как есть!
    parameters
  };
}
```

`column` здесь принимается из внешнего кода. Хотя TypeScript ограничивает `keyof T`, при использовании `as any` или динамических данных это — прямая SQL инъекция через имя столбца.

Также: `column` — это опять `propertyName`, не `columnName`.

### Проблема 4: `GlobalFilterApplier` — хардкод `= 0` для soft delete

```ts
// packages/core/src/query/GlobalFilterApplier.ts
if (softDeleteOptions?.enabled) {
  const flagPropOrCol = softDeleteOptions.column ?? 'isDeleted';
  const col = selfMeta.columns.find(
    (c) => c.propertyName === flagPropOrCol || c.columnName === flagPropOrCol
  );
  if (col) {
    model.where.push({ condition: `${col.columnName} = 0`, parameters: [] });
    //                                                  ^^^
    // PostgreSQL BOOLEAN: WHERE is_deleted = 0 → ERROR: operator does not exist: boolean = integer
    // SQLite: WHERE is_deleted = 0 → OK (приводит к integer comparison)
    // MySQL: WHERE is_deleted = 0 → OK (TINYINT(1))
  }
}
```

В PostgreSQL boolean-столбцы сравниваются через `= false`, а не `= 0`. Хардкод `= 0` ломает soft delete на PostgreSQL.

### Проблема 5: `orderBy`/`thenBy` тоже используют propertyName

```ts
public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
  const keySelectorStr = keySelector.toString();
  const column = this.extractPropertyFromKeySelector(keySelectorStr); // ← propertyName!
  const orderByClause: OrderByClause = { column, direction: 'ASC' };
  ...
}
```

`extractPropertyFromKeySelector` использует regex `/=>\s*\w+\.(\w+)/` — возвращает JS-имя свойства. Если `User.firstName` имеет `columnName: 'first_name'`, то ORDER BY будет `ORDER BY firstName ASC` — неверно.

---

## Предлагаемое решение

### Шаг 1: Resolve propertyName → columnName через MetadataStorage в SqlVisitor

```ts
export class BinaryVisitor {
  constructor(private readonly entityClass: Function) {}

  public visit(node: BinaryExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const propertyName = node.left.name;
    const column = this.resolveColumnName(propertyName);
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${this.quoteIdentifier(column)} ${op} ?`, parameters: [value] };
  }

  private resolveColumnName(propertyName: string): string {
    const meta = MetadataStorage.getEntity(this.entityClass);
    const col = meta?.columns.find(c => c.propertyName === propertyName);
    return col?.columnName ?? propertyName; // fallback к propertyName если нет маппинга
  }

  private quoteIdentifier(name: string): string {
    // Provider-specific quoting: "name" for PG, `name` for MySQL, [name] for MSSQL
    return `"${name.replace(/"/g, '""')}"`;
  }
}
```

### Шаг 2: Исправить `GlobalFilterApplier` — provider-aware soft delete

```ts
// Передавать диалект или провайдер в GlobalFilterApplier
if (softDeleteOptions?.enabled && col) {
  const falseValue = dialect.booleanFalse(); // 'false' для PG, '0' для MySQL/SQLite
  model.where.push({ 
    condition: `${col.columnName} = ${falseValue}`, 
    parameters: [] 
  });
}
```

Или через параметризованный запрос:

```ts
model.where.push({ 
  condition: `${col.columnName} = ?`, 
  parameters: [false]  // провайдер сам преобразует в нужный тип
});
```

### Шаг 3: Исправить `keysetPaginate` — маппинг ключа

```ts
public async keysetPaginate<TKey extends keyof T>(key: TKey, ...): Promise<...> {
  const meta = MetadataStorage.getEntity(this._entityClass);
  const col = meta?.columns.find(c => c.propertyName === String(key));
  const columnName = col?.columnName ?? String(key);
  
  const whereClause: WhereClause = {
    condition: `${this.quoteIdentifier(columnName)} > ?`,
    parameters: [after as unknown as SqlParameter]
  };
}
```

### Шаг 4: Квотирование идентификаторов для безопасности

Все имена столбцов должны быть квотированы через диалект-специфичный `quoteIdentifier()`, чтобы избежать SQL-инъекций через имена свойств и зарезервированные слова (`order`, `from`, `group`, `user` — всё это потенциальные имена столбцов).
