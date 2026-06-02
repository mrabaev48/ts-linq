# CLAUDE.md — @ts-linq/plugin-audit

## Role

Audit-logging plugin built on the `OrmMiddleware` lifecycle contract.

## Hard boundaries

- Depends on `types`, `metadata`. Must not depend on `orm`/`core` internals — only the public
  middleware contract.

## ⚠️ Critical status — orphaned plugin

- **No package depends on this plugin**, and the `OrmMiddleware` lifecycle hooks it implements are
  **never invoked** by the ORM runtime. As written, registering it has no effect.
- This is a wire-or-retire decision (refactor `task-1`, P0; tied to `_shared/task-1` which decides
  the canonical extension-point contract). Do not assume it works end-to-end until that lands.

## Critical invariants & known hazards

- Audit writes must not silently swallow failures — a dropped audit record is a compliance gap
  (refactor `task-2`).
- Capturing change context must use the metadata model (which columns/keys), not ad-hoc reflection.

## Public API surface & stability

- Public via `src/index.ts` (`AuditMiddleware`, types).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/plugin-audit/` (1× P0 wire-or-retire) and
`_shared/task-1` (unify the extension-point contract).

## Validation

```bash
pnpm --filter @ts-linq/plugin-audit typecheck
pnpm --filter @ts-linq/plugin-audit lint
pnpm --filter @ts-linq/plugin-audit test
pnpm --filter @ts-linq/plugin-audit build
```

## Do / Don't

- **Do** resolve the wire-or-retire question against `_shared/task-1` before extending features.
- **Don't** swallow audit-write failures; don't bypass the middleware contract.
