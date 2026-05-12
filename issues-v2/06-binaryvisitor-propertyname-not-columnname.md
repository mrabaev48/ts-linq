# Issue #06 — BinaryVisitor Использует propertyName Вместо columnName в SQL

**Severity:** High  
**Status:** Остаётся — проблема теперь в `packages/ast`  
**Affected files:**
- `packages/ast/src/visitors/BinaryVisitor.ts`
- `packages/ast/src/ast/SqlVisitor.ts`
- `packages/query/src/GlobalFilterApplier.ts` (soft-delete hardcode)

---

## Описание проблемы

### A: BinaryVisitor — путь из AST не резолвится в columnName

`BinaryVisitor` берёт `MemberAccess.path` напрямую и использует как имя SQL-столбца:

```ts
// packages/ast/src/visitors/BinaryVisitor.ts:13-17
public visit(
  node: BinaryExpressionNode,
  inputParameters: readonly SqlParameter[] = []
): { condition: string; parameters: SqlParameter[] } {
  const column = this.renderMemberAccess(node.left);  // path.join('.')
  ...
  return { condition: `(${column} ${op} ?)`, parameters: [value] };
}

private renderMemberAccess(node: MemberAccessNode): string {
  ...
  return node.path.join('.');  // ← ['userId'] → 'userId', НЕ 'user_id'!
}
```

Трансформер записывает в AST **property name** из TypeScript кода (например, `userId`),
а `BinaryVisitor` использует это как имя столбца. Если в базе столбец называется `user_id`,
SQL получится неверным:

```sql
-- Ожидается:
WHERE (user_id = ?)

-- Получается:
WHERE (userId = ?)  ← синтаксическая ошибка или игнорирование случайного совпадения
```

### B: GlobalFilterApplier — soft-delete хардкодит `= 0`

```ts
// packages/query/src/GlobalFilterApplier.ts:22
model.where.push({ condition: `${col.columnName} = 0`, parameters: [] });
```

Для SQLite/MySQL `= 0` корректно для булевых столбцов. Для PostgreSQL:
- Столбец `BOOLEAN` хранит `true`/`false`, не `1`/`0`
- Условие `is_deleted = 0` вызывает ошибку типа: `operator does not exist: boolean = integer`

Корректный SQL для PostgreSQL: `is_deleted = false`.

## Цепочка данных: от TypeScript до SQL

```
TypeScript:   where(u => u.userId === 42)
Transformer:  MemberAccess.path = ['userId']   ← property name
BinaryVisitor: column = 'userId'               ← property name
SQL:          WHERE (userId = ?)               ← НЕВЕРНО если column_name = 'user_id'
```

Нигде в этой цепочке нет вызова `MetadataStorage.getEntity()` для резолва `columnName`.

## Предлагаемое решение

### Вариант A: Резолюция в SqlVisitor на уровне `@ts-linq/ast`

Передавать маппинг `propertyName → columnName` в `SqlVisitor`:

```ts
// packages/ast/src/ast/SqlVisitor.ts
export class SqlVisitor {
  public toSql(
    node: ExpressionNode,
    inputParameters: readonly SqlParameter[],
    columnResolver?: (propertyPath: readonly string[]) => string  // ← новый параметр
  ): { condition: string; parameters: SqlParameter[] } { ... }
}
```

```ts
// packages/query/src/Queryable.ts — при вызове visitor:
const resolver = (path: readonly string[]) => {
  const meta = MetadataStorage.getEntity(this._entityClass);
  const prop = path[path.length - 1]!;
  return meta?.columns.find(c => c.propertyName === prop)?.columnName ?? prop;
};
const { condition, parameters } = visitor.toSql(input.ast, input.parameters, resolver);
```

### Для GlobalFilterApplier — диалект-специфичное значение

```ts
// packages/query/src/GlobalFilterApplier.ts
const boolFalse = dialect?.boolFalseValue?.() ?? '0';  // '0' для SQLite, 'false' для PG
model.where.push({ condition: `${col.columnName} = ${boolFalse}`, parameters: [] });
```

Или использовать параметризованный запрос:
```ts
model.where.push({ condition: `${col.columnName} = ?`, parameters: [false] });
```

Провайдер сам преобразует `false` в `0` или `false` по диалекту.
