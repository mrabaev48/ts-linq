# Issue #09 — Transformer Отклоняет `||`, Но Runtime LogicalVisitor Поддерживает OR

**Severity:** High  
**Status:** Новая несогласованность  
**Affected files:**
- `packages/transformer/src/ExpressionParser.ts` (строка 323-325)
- `packages/ast/src/visitors/LogicalVisitor.ts`
- `packages/ast/src/ast/Nodes.ts`

---

## Описание проблемы

`LogicalVisitor` и AST-типы полностью поддерживают `OR`:

```ts
// packages/ast/src/ast/Nodes.ts:3-5
export enum LogicalOperator {
  And = 'AND',
  Or = 'OR'  // ← определён
}

// packages/ast/src/visitors/LogicalVisitor.ts:25
const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
// ← Runtime поддерживает OR, генерирует правильный SQL
```

Но трансформер **явно отклоняет** `||` с ошибкой компиляции:

```ts
// packages/transformer/src/ExpressionParser.ts:323-325
if (op === ts.SyntaxKind.BarBarToken) {
  pushError(ctx, e.operatorToken, `ts-linq(${ctx.methodName}): unsupported operator '||'`);
  return null;
}
```

## Последствия

```ts
// Это НЕ КОМПИЛИРУЕТСЯ — transformer выдаёт ошибку:
ctx.users.where(u => u.age > 18 || u.role === 'admin');
// Error: ts-linq(where): unsupported operator '||'

// Хотя runtime полностью готов обработать OR:
ctx.users.whereCompiled({
  ast: {
    type: 'LogicalExpression',
    operator: LogicalOperator.Or,  // ← работает!
    expressions: [...]
  },
  parameters: []
});
```

Пользователь вынужден:
1. Дублировать запросы: `.where(u => u.age > 18).union(ctx.users.where(u => u.role === 'admin'))`
2. Или переписывать логику на два отдельных запроса с объединением в JS

## Почему это несогласованность

AST package определяет `OR`, runtime обрабатывает `OR`, но transformer не генерирует `OR`.
Если кто-то вручную создаст `LogicalExpression` с `Or` и передаст в `whereCompiled` — всё сработает.
Трансформер — единственное место, которое блокирует эту функциональность.

## Предлагаемое решение

Добавить поддержку `||` в `ExpressionParser.ts` по аналогии с `&&`:

```ts
// packages/transformer/src/ExpressionParser.ts
if (op === ts.SyntaxKind.BarBarToken) {
  requiredImports.add('LogicalOperator');
  const flattened: ts.Expression[] = [];
  let hasError = false;
  const collect = (n: ts.Expression): void => {
    const inner = unwrapParens(n);
    if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      collect(inner.left);
      collect(inner.right);
      return;
    }
    const parsed = parseExpression(factory, inner, ctx, requiredImports, capturedParameters);
    if (!parsed) { hasError = true; return; }
    flattened.push(parsed);
  };
  collect(e);
  if (hasError || flattened.length === 0) {
    pushError(ctx, e, `ts-linq(${ctx.methodName}): unsupported expression`);
    return null;
  }
  return createLogicalExpressionNode(factory, enumAccess(factory, 'LogicalOperator', 'Or'), flattened);
}
```

Это полное зеркало существующей `&&` логики, заменить только `And` → `Or` и `&&` → `||`.
Изменение минимальное, риск регрессий низкий.
