# ISSUE-006: AST Visitors Hardcode SQL Syntax, Breaking Dialect Abstraction

## Severity

Critical

## Category

- Clean Architecture
- Dependency Boundary
- Maintainability

## Location

- `packages/ast/src/visitors/BinaryVisitor.ts`
- `packages/ast/src/visitors/InVisitor.ts`
- `packages/ast/src/visitors/NullVisitor.ts`
- `packages/ast/src/visitors/LogicalVisitor.ts`
- `packages/ast/src/visitors/UnaryVisitor.ts`
- `packages/ast/src/visitors/MethodVisitor.ts`
- `packages/ast/src/SqlVisitor.ts`

## Problem

`@ts-linq/ast` is positioned as the dialect-agnostic expression AST layer: it defines the node types produced by the compile-time transformer and consumed by query execution. However, the visitor implementations in `packages/ast/src/visitors/` directly emit SQL string fragments, hardcoding generic SQL syntax:

- **BinaryVisitor**: maps JS operators to SQL operators (`===`→`=`, `!==`→`!=`, preserves `<`, `>`, `<=`, `>=`, `LIKE` as-is)
- **InVisitor**: emits `(col IN (?, ?))` with `?` placeholders — MySQL/SQLite syntax, not PostgreSQL `$1`
- **NullVisitor**: emits `col IS NULL` / `col IS NOT NULL`
- **MethodVisitor**: emits `col LIKE ?` / `col NOT LIKE ?` — again `?` placeholders
- **LogicalVisitor**: emits `(left AND right)` / `(left OR right)`

The placeholder style `?` is MySQL/SQLite convention. PostgreSQL uses `$1`, `$2`. MSSQL uses `@p1`. The current implementation produces generic SQL that happens to work for dialects with `?` parameters but cannot be extended for parameter-indexed dialects without modifying the AST package.

## Evidence

`packages/ast/src/visitors/InVisitor.ts:21`:
```ts
return { condition: `(${col} IN (${placeholders}))`, parameters: params };
```

`packages/ast/src/visitors/BinaryVisitor.ts:32-38`:
```ts
case '===':
case '==':
  return '=';
case '!==':
case '!=':
  return '!=';
```

`packages/ast/src/SqlVisitor.ts` orchestrates all visitors and returns a `ConditionFragment` with SQL strings — this entire class belongs in `@ts-linq/sql-visitor`.

## Why It Matters

- **Dialect extensibility**: PostgreSQL's `$1/$2` positional parameters cannot be produced without modifying `@ts-linq/ast`. The current workaround is likely parameter rewriting in the dialect layer, adding complexity.
- **Layer purity**: AST nodes should represent *what* to query, not *how* to render it in SQL. This is the fundamental purpose of the AST layer.
- **Testing**: Verifying correct parameter binding for a specific dialect requires running the full AST → SQL pipeline, not testing the dialect in isolation.
- **Future DSLs**: Reusing the AST for non-SQL outputs (query plan analysis, REST filter serialization) is impossible while SQL emission lives in the AST package.

## Recommended Fix

This issue is closely related to ISSUE-005 (sql-visitor stub). The combined fix:

1. Remove all SQL-emitting code from `packages/ast/src/visitors/` and `packages/ast/src/SqlVisitor.ts`.
2. `@ts-linq/ast` retains only: `ast/Nodes.ts` (node type union), `ast/Specification.ts`, error types, and the `ConditionFragment`/`SqlFragment` type shapes.
3. Move all visitor implementations to `@ts-linq/sql-visitor`.
4. Introduce a `ParameterStyle` enum (`positional` for PostgreSQL, `named` for MSSQL, `question` for MySQL) that `SqlVisitor` accepts to control placeholder rendering.

## Acceptance Criteria

- `packages/ast/src/` contains no string template literals producing SQL fragments.
- `@ts-linq/sql-visitor` exports a `SqlVisitor` that accepts a `ParameterStyle`.
- PostgreSQL dialect can produce `$1, $2` parameters via the visitor.
- `@ts-linq/ast` has zero knowledge of SQL syntax.
