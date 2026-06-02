# CLAUDE.md — @ts-linq/plugin-multi-tenant

## Role

Multi-tenancy plugin: scopes queries to the current tenant via the `OrmMiddleware` lifecycle.

## Hard boundaries

- Depends on `types`, `metadata`. Only the public middleware contract — no `orm`/`core` internals.

## 🔴 Critical security & status

- **SQL injection (P0).** `MultiTenantMiddleware.getFilterCondition()` interpolates the tenant id
  (and tenant column) straight into a raw SQL `WHERE` fragment. A tenant id like `x' OR '1'='1`
  defeats isolation and exposes all tenants' rows — the exact opposite of the plugin's purpose.
  Fix: emit a **parameterized predicate** / register a `GlobalFilter`, never SQL text (refactor
  `task-4`, P0). The plugin must never build SQL strings.
- **Fail-closed isolation.** A tenant-resolver failure must **not** fall through to an unfiltered
  query (fail-open). On resolver error, refuse the query.
- **Orphaned:** the middleware lifecycle is not invoked by the runtime today (refactor `task-1`,
  P0; tied to `_shared/task-1`).

## Public API surface & stability

- Public via `src/index.ts` (`MultiTenantMiddleware`, `MultiTenantOptions`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/plugin-multi-tenant/` (2× P0: injection + wire/retire).

## Validation

```bash
pnpm --filter @ts-linq/plugin-multi-tenant typecheck
pnpm --filter @ts-linq/plugin-multi-tenant lint
pnpm --filter @ts-linq/plugin-multi-tenant test
pnpm --filter @ts-linq/plugin-multi-tenant build
```

## Do / Don't

- **Do** return parameterized predicates / `GlobalFilter`s; quote identifiers via the provider.
- **Do** fail closed when the tenant can't be resolved.
- **Don't** ever interpolate tenant id/column into raw SQL.
