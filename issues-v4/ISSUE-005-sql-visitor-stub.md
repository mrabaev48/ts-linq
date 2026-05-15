# ISSUE-005: @ts-linq/sql-visitor Is an Unimplemented Stub

## Severity

Critical

## Category

- Clean Architecture
- Maintainability
- Dependency Boundary

## Location

- `packages/sql-visitor/src/index.ts`
- `packages/ast/src/visitors/` (current incorrect home of SQL generation)

## Problem

The `@ts-linq/sql-visitor` package exists in the monorepo with only a placeholder export:

```ts
// SQL Visitor - Coming Soon
// This package will provide SQL AST visitor pattern implementation

export const placeholder = 'sql-visitor';
```

Despite this package existing in name, all SQL generation from the AST currently lives inside `packages/ast/src/visitors/`:
- `BinaryVisitor.ts` — maps TypeScript operators to SQL operators (`===` → `=`)
- `InVisitor.ts` — generates `(col IN (?, ?))` SQL fragments
- `NullVisitor.ts` — generates `IS NULL`, `IS NOT NULL`
- `LogicalVisitor.ts` — generates `AND`, `OR`
- `UnaryVisitor.ts` — generates `NOT`
- `MethodVisitor.ts` — generates `LIKE`, `NOT LIKE` etc.
- `packages/ast/src/SqlVisitor.ts` — orchestrates the above into a full WHERE clause

This is architecturally inverted: `@ts-linq/ast` should define a pure, dialect-agnostic expression representation. SQL rendering is a concern of a higher layer.

## Evidence

- `packages/sql-visitor/src/index.ts`:
  ```ts
  export const placeholder = 'sql-visitor';
  ```
- `packages/ast/src/visitors/InVisitor.ts:21`:
  ```ts
  return { condition: `(${col} IN (${placeholders}))`, parameters: params };
  ```
- `packages/ast/src/visitors/BinaryVisitor.ts:32-38`: maps `===` → `=`, `!==` → `!=`
- `packages/ast/src/SqlVisitor.ts`: full SQL generation orchestration inside the AST package

## Why It Matters

- **Extensibility**: Adding dialect-specific SQL syntax (PostgreSQL `$1` params, MSSQL `@p1`, JSON operators) requires modifying `@ts-linq/ast`, which is supposed to be dialect-neutral.
- **Layer violation**: AST is a query representation layer; SQL generation is an output/rendering concern. Mixing them prevents reusing the AST for purposes other than SQL (e.g., query plan analysis, serialization, REST filter DSL).
- **Coupling**: Every dialect must inherit or depend on the ast package's SQL visitor, even if it needs custom rendering.
- **Dead package**: `@ts-linq/sql-visitor` occupies a monorepo slot, has a build configuration, but delivers no value.

## Recommended Fix

1. Implement `@ts-linq/sql-visitor` with a `SqlVisitorBase` abstract class accepting dialect-specific rendering hooks.
2. Move all visitor classes from `packages/ast/src/visitors/` to `packages/sql-visitor/src/visitors/`.
3. Move `SqlVisitor.ts` to `@ts-linq/sql-visitor`.
4. `@ts-linq/ast` retains only pure node type definitions (`Nodes.ts`) and no SQL-emitting code.
5. Dialect packages (`@ts-linq/dialect-postgres`, etc.) can extend `SqlVisitorBase` for dialect-specific behavior (e.g., PostgreSQL `$1/$2` positional parameters, MSSQL `@p1`).

## Acceptance Criteria

- `packages/ast/src/visitors/` contains no SQL string generation.
- `packages/sql-visitor/src/index.ts` exports a functional `SqlVisitor` class.
- `@ts-linq/sql-visitor` depends on `@ts-linq/ast` and `@ts-linq/types`; `@ts-linq/ast` does not depend on `@ts-linq/sql-visitor`.
- Dialect packages can override or extend visitor behavior for dialect-specific SQL syntax.
