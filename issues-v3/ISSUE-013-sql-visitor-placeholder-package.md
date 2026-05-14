# ISSUE-013: `@ts-linq/sql-visitor` Is an Empty Placeholder Package

## Severity

Medium

## Category

- Maintainability
- Build/Tooling
- Clean Architecture

## Location

- `packages/sql-visitor/src/index.ts`
- `packages/ast/src/visitors/` — `BinaryVisitor.ts`, `InVisitor.ts`, `LogicalVisitor.ts`, `MethodVisitor.ts`, `NullVisitor.ts`, `UnaryVisitor.ts`

## Problem

The `@ts-linq/sql-visitor` package is registered in the monorepo workspace but its entire implementation is a placeholder:

```typescript
// packages/sql-visitor/src/index.ts
// SQL Visitor - Coming Soon
// This package will provide SQL AST visitor pattern implementation

export const placeholder = 'sql-visitor';
```

Meanwhile, a complete, working visitor implementation already exists inside `@ts-linq/ast`:

- `packages/ast/src/visitors/BinaryVisitor.ts`
- `packages/ast/src/visitors/LogicalVisitor.ts`
- `packages/ast/src/visitors/InVisitor.ts`
- `packages/ast/src/visitors/MethodVisitor.ts`
- `packages/ast/src/visitors/NullVisitor.ts`
- `packages/ast/src/visitors/UnaryVisitor.ts`

This creates a structural ambiguity: the visitor pattern is split between a real implementation in `@ts-linq/ast` and a promised-but-empty dedicated package. Consumers and contributors cannot know which package is the intended home for SQL visitor logic.

## Evidence

```typescript
// packages/sql-visitor/src/index.ts (the entire file)
// SQL Visitor - Coming Soon
export const placeholder = 'sql-visitor';
```

The real visitors in `packages/ast/src/visitors/` are actively used by `SqlVisitor` (the dispatcher) which is also in `@ts-linq/ast`, meaning the entire visitor system is already self-contained in `@ts-linq/ast`.

## Why It Matters

- **Maintainability**: A placeholder package with "Coming Soon" comments suggests planned architecture that diverges from current reality. Contributors will not know where to add new visitor types.
- **Coupling risk**: If `@ts-linq/sql-visitor` is eventually filled in, it will need to either duplicate or import from `@ts-linq/ast` — neither is clean. If it imports from `@ts-linq/ast`, the dependency direction is reversed from the stated intent.
- **Build/Tooling**: The package adds overhead to the monorepo build graph for zero functional output.
- **Documentation drift**: Any documentation referencing `@ts-linq/sql-visitor` as a separate concerns package conflicts with the actual implementation location.

## Recommended Fix

**Option A — Remove the placeholder package**:
1. Delete `packages/sql-visitor/`
2. Keep visitors in `packages/ast/src/visitors/` — they belong there conceptually (AST + visitor is a well-understood pattern unit)
3. Export visitors from `@ts-linq/ast` public API if external consumers need to implement custom visitors

**Option B — Migrate existing visitors into `@ts-linq/sql-visitor`**:
1. Move `BinaryVisitor`, `LogicalVisitor`, etc. from `packages/ast/src/visitors/` to `packages/sql-visitor/src/`
2. Update `@ts-linq/ast` to depend on `@ts-linq/sql-visitor`
3. Ensure `@ts-linq/sql-visitor` depends only on `@ts-linq/ast` (for AST node types) and `@ts-linq/types`

Option A is recommended unless visitors are intended to be extensible by external consumers (e.g., custom dialects implementing custom visitors). In that case, Option B with a clear extension point interface is the right move.

## Acceptance Criteria

- `packages/sql-visitor/src/index.ts` does not export a `placeholder` constant
- Either the package is removed OR it contains a real implementation of the visitor pattern
- There is exactly one home for SQL visitor logic in the monorepo
- The public API of whichever package owns visitors is documented
