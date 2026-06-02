---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P0
effort: M
risk: critical
category: sql
depends_on: []
related: ["plugin-soft-delete/task-4.md", "_shared/task-1.md"]
---

# Refactor: Eliminate SQL injection in tenant filter construction

## Problem

`MultiTenantMiddleware.getFilterCondition()` builds a raw SQL `WHERE` fragment by concatenating the
tenant id into the string. A string tenant id is wrapped in single quotes with no escaping, so a
crafted tenant id injects SQL.

## Evidence

`packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:88-106`:

```ts
async getFilterCondition(): Promise<string | null> {
  ...
  const tenantId = await this.getTenant();
  ...
  const column = this.options.tenantIdColumn!;
  const value = typeof tenantId === 'string' ? `'${tenantId}'` : tenantId;
  return `${column} = ${value}`;   // <-- raw interpolation
}
```

Both `column` (line 102, from options) and `value` (line 103) are interpolated unescaped.
`tenantIdColumn` is also user-supplied via `MultiTenantOptions.tenantIdColumn`
(`types.ts:14-15`), so the column name is an injection vector too.

## Why this is bad

- A tenant id such as `x' OR '1'='1` yields `tenantId = 'x' OR '1'='1'`, defeating isolation and
  exposing all tenants' rows — the exact opposite of the plugin's purpose.
- Bypasses the provider's parameterization and dialect quoting; the fragment is dialect-assumed
  (single-quote string literal) and not portable.
- Violates the project rule that runtime behaviour must go through provider/SQL layers, not ad-hoc
  string building.

## Target architecture

The plugin must never emit SQL text. Apply **Dependency Inversion**: depend on the provider's
predicate/parameter abstraction and return a *parameterized* predicate (column reference + bound
parameter), or a global-query-filter expression that the existing query pipeline compiles safely.

Reuse the ORM's existing global query-filter mechanism (the codebase already has `GlobalFilter` in
`@ts-linq/types` and per-context filter handling in `@ts-linq/orm`) instead of inventing a parallel
raw-SQL path. **Strategy** for per-dialect identifier quoting belongs in the provider, not the plugin.

## Proposed refactor

1. Replace `getFilterCondition(): string` with an API that returns a structured predicate
   (e.g. `{ column, op: '=', param }`) or registers a `GlobalFilter` lambda on the context.
2. Bind the tenant id as a SQL parameter; quote the column via the provider's identifier quoter.
3. Delete the string-interpolation branch entirely.
4. Add a regression test with an injection payload.

## Suggested design patterns

- **Dependency Inversion / Ports & Adapters** — plugin emits a predicate port, provider renders SQL.
- **Strategy** — provider-owned identifier quoting + parameter binding per dialect.
- **Value Object** — a `TenantPredicate` object instead of a raw string.

## Testing plan

- **Security:** tenant id `"' OR '1'='1"` and column name `"x; DROP TABLE"` produce a safe
  parameterized predicate, asserted at the SQL/param level (no payload in the SQL text).
- **Behaviour:** numeric and string tenant ids both bind as parameters.
- **Dialect:** identifier quoting differs correctly per provider.

## Acceptance criteria

- [ ] `getFilterCondition` no longer returns interpolated SQL.
- [ ] Tenant id is always a bound parameter.
- [ ] Column identifier is quoted by the provider, not interpolated.
- [ ] Injection regression test passes.
- [ ] No raw `'${...}'` SQL string concatenation remains in the package.

## Refactor order

1. Add predicate/param return type. 2. Route through provider/global-filter. 3. Delete raw branch.
4. Security tests.

## Notes

This is a security defect, prioritise above the keep/retire decision **if** any path can call
`getFilterCondition`. If `_shared/task-1` retires the plugin, the vulnerable method is deleted with it
— still verify no copy was lifted elsewhere.
