---
status: not-started
phase: phase-x
package: plugin-soft-delete
priority: P1
effort: M
risk: medium
category: sql
depends_on: ["_shared/task-1.md"]
related: ["plugin-multi-tenant/task-4.md"]
---

# Refactor: Remove raw, dialect-coupled SQL from `getFilterCondition`

## Problem

`getFilterCondition()` returns a hand-built SQL string with a hard-coded boolean encoding (`= 0`),
bypassing the provider's dialect layer and parameterization. It assumes booleans are stored as `0/1`,
which is false for providers using native `BOOLEAN`/`true`/`false`.

## Evidence

`packages/plugin-soft-delete/src/SoftDeleteMiddleware.ts:91-101`:

```ts
getFilterCondition(): string {
  if (!this.options.filterDeleted) return '';
  if (this.options.type === 'boolean') {
    return `${this.options.column} = 0 OR ${this.options.column} IS NULL`;
  } else {
    return `${this.options.deletedAtColumn} IS NULL`;
  }
}
```

- `${this.options.column}` and `${this.options.deletedAtColumn}` are interpolated as identifiers with
  no quoting (config-controlled, but still bypasses dialect identifier quoting).
- `= 0` hard-codes boolean-as-integer; Postgres `boolean` columns use `false`/`true`.
- The fragment is precedence-fragile: `A = 0 OR A IS NULL` unparenthesised can mis-bind when AND-ed
  into a larger WHERE.

## Why this is bad

- Dialect coupling — produces invalid/incorrect SQL on providers with native booleans.
- Bypasses the provider's parameterization and quoting (consistency + injection-surface concern even
  though values here are not user data, the identifier is config-controlled).
- Precedence bug risk when composed.

## Target architecture

Express the "not deleted" condition as a structured predicate (column ref + IS NULL / equality with a
typed boolean value) and let the provider render dialect-correct, parenthesised, parameterized SQL.
Reuse the ORM's existing global-query-filter mechanism rather than emitting raw strings. **Dependency
Inversion** + **Strategy** (per-dialect boolean rendering owned by the provider).

## Proposed refactor

1. Replace the string return with a predicate AST / `GlobalFilter` lambda
   (`e => e.isDeleted !== true` style) compiled by the existing pipeline.
2. Remove the `= 0` integer assumption; let the dialect render booleans.
3. Ensure the composed predicate is correctly grouped.
4. Tests across dialects.

## Suggested design patterns

- **Dependency Inversion / Ports & Adapters**, **Strategy** (dialect boolean rendering), **Value Object**
  (predicate descriptor).

## Testing plan

- Postgres (native boolean) and MySQL/SQLite (0/1) both produce correct, parenthesised filters.
- `filterDeleted: false` → no predicate contributed.
- Timestamp mode → `deletedAt IS NULL` rendered correctly.

## Acceptance criteria

- [ ] No raw SQL string returned from the package.
- [ ] Boolean encoding is dialect-rendered, not hard-coded `= 0`.
- [ ] Composed predicate is correctly grouped.
- [ ] Cross-dialect tests pass.

## Refactor order

1. Predicate return. 2. Route through global-filter pipeline. 3. Cross-dialect tests.

## Notes

If `_shared/task-1`/`plugin-soft-delete/task-1` retires the plugin, this logic must still land in the
surviving interceptor's query-filter path.
