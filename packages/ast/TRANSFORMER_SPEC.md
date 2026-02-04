# Build-time transformer integration (Variant A / Strategy 2)

This document specifies how a TypeScript compiler transformer should integrate with `@ts-linq/query` and `@ts-linq/ast` to support the runtime-friendly contract:

```ts
where(u => /* predicate */)
// becomes (compile-time)
whereCompiled({ ast, parameters })
```

## Goals

- Preserve the developer UX: users write `where(u => ...)`.
- Avoid runtime parsing via `Function#toString()` and regex.
- Support closure-captured values by emitting `ParameterRef` nodes and a separate `parameters` array.
- Validate supported expressions at compile-time (TypeChecker-backed) and emit clear diagnostics.

## Target runtime contract

### AST (`@ts-linq/ast`)

- The transformer emits `ExpressionNode` trees using:
  - `MemberAccessNode` for left-hand column/property paths.
  - `LiteralNode` for inlined SQL literals.
  - `ParameterRefNode` for runtime values captured from the surrounding scope.

### Parameters

- The transformer emits a **runtime expression array** that will evaluate when the application runs:
  - Example: `const minAge = getMinAge(); where(u => u.age >= minAge)`
  - Output: `parameters: [minAge]` and AST right-hand side uses `ParameterRef(index: 0)`

### SQL generation

- Runtime SQL generation calls:
  - `new SqlVisitor().toSql(ast, inputParameters)`
- `ParameterRef(index)` is resolved against `inputParameters[index]` and appended to the output parameter list in a deterministic traversal order.

## Identification rules (TypeChecker)

The transformer must only rewrite calls that are definitely `@ts-linq/query` `Queryable.where`:

1. Find a `CallExpression` with a `PropertyAccessExpression` whose name is `where`.
2. Resolve the call signature via `checker.getResolvedSignature(call)`.
3. Ensure the declaration symbol belongs to the `Queryable` method from `@ts-linq/query` (match by declaration source file path / symbol name).
4. Ignore any other `.where(...)` to avoid accidental rewrites (arrays, RxJS, lodash, etc.).

## Supported expression subset (v1)

### Allowed

- Predicate argument is an `ArrowFunction` with a single parameter.
- Body must be an expression (not a block).
- Operators:
  - `&&` → `LogicalOperator.And`
  - `!` → `UnaryExpression(Not, operand)`
  - Comparisons: `===`, `==`, `>`, `>=`, `<`, `<=` → `ComparisonOperator`
- Parentheses are allowed (preserved structurally).
- Left-hand side must be a property path rooted at the lambda parameter:
  - `u.age`
  - `u.profile.age`
  - Emits `MemberAccessNode { path: ['age'] }` / `['profile','age']`
- Right-hand side must be either:
  - A literal (`number`, `string`, `boolean`, `null`)
  - Or an expression that **does not reference the lambda parameter** (closure value) → emitted as `ParameterRef` + pushed to `parameters[]`

### Disallowed (compile-time error in v1)

- Function calls, `new`, template strings, ternary, assignments, `await`, `yield`.
- `||`, `??` (can be added later as explicit AST extensions).
- Any right-hand expression that references the lambda parameter (would make it row-dependent).

## Parameterization rules

- Each captured value becomes a `ParameterRef(index)` where `index` is the insertion order into `parameters[]`.
- Duplicate captured expressions may be either:
  - kept duplicated (simplest, stable), or
  - deduplicated by syntactic identity (optional optimization; must preserve deterministic ordering).

## Diagnostics

Prefer failing fast at compile-time with clear messages (English):

- `ts-linq(where): unsupported operator '||'`
- `ts-linq(where): left operand must be a member access rooted at the lambda parameter`
- `ts-linq(where): right operand must be a literal or a closure value`
- `ts-linq(where): unary '!' is only supported for MemberAccess or boolean expressions`

## Output shape example

Input:

```ts
const minAge = 21;
q.where(u => u.profile.age >= minAge && u.isActive === true);
```

Output:

```ts
q.whereCompiled({
  ast: {
    type: "LogicalExpression",
    operator: "AND",
    expressions: [
      {
        type: "BinaryExpression",
        left: { type: "MemberAccess", path: ["profile", "age"] },
        operator: ">=",
        right: { type: "ParameterRef", index: 0 }
      },
      {
        type: "BinaryExpression",
        left: { type: "MemberAccess", path: ["isActive"] },
        operator: "=",
        right: { type: "Literal", value: true }
      }
    ]
  },
  parameters: [minAge]
});
```

## Unary NOT semantics

- `!u.isActive` should be emitted as:
  - `UnaryExpression(Not, MemberAccess(['isActive']))`
- Runtime SQL generation maps this to:
  - `(isActive = ?)` with parameter `false` (not `NOT isActive`), for portability and explicitness.

