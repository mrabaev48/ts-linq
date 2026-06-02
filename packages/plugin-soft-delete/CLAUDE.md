# CLAUDE.md — @ts-linq/plugin-soft-delete

## Role

Soft-delete plugin: converts deletes into flag updates and filters soft-deleted rows, via the
`OrmMiddleware` lifecycle.

## Hard boundaries

- Depends on `types`, `metadata`. Only the public middleware contract.

## ⚠️ Critical status — duplicate + orphaned

- **`@ts-linq/orm` already has soft-delete support** (interceptor + global filter). This plugin is a
  **duplicate** of that logic and should likely be retired/folded rather than maintained in parallel
  (refactor `task-1`, P0).
- The middleware lifecycle it targets is **not invoked** by the runtime today (tied to
  `_shared/task-1`). Registering it currently has no effect.
- `SoftDeleteOptions` is also defined canonically in `@ts-linq/types` — don't fork the shape here.

## Critical invariants & known hazards

- The soft-delete filter must apply consistently and not be silently droppable (row-leak risk,
  mirrors the global-filter hazard in `query`).
- Deleting must update the configured flag/column atomically with normal change tracking.

## Public API surface & stability

- Public via `src/index.ts` (`SoftDeleteMiddleware`, options).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/plugin-soft-delete/` (1× P0 retire/fold) and
`_shared/task-1`.

## Validation

```bash
pnpm --filter @ts-linq/plugin-soft-delete typecheck
pnpm --filter @ts-linq/plugin-soft-delete lint
pnpm --filter @ts-linq/plugin-soft-delete test
pnpm --filter @ts-linq/plugin-soft-delete build
```

## Do / Don't

- **Do** reconcile with `orm`'s built-in soft delete before adding features.
- **Don't** fork `SoftDeleteOptions`; don't maintain parallel logic.
