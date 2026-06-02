# CLAUDE.md — @ts-linq/pagination

## Role

Intended standalone **pagination helpers**. Currently a **placeholder stub**.

## ⚠️ Status & overlap

- `src/index.ts` is a stub; no dependencies; version `2.0.0-alpha.1`.
- **Pagination already exists** in `@ts-linq/query` (`PaginationBuilder`, `take`/`skip`, async
  paging). Before implementing anything here, decide whether this package should exist at all or be
  folded into `query` (refactor task below). Avoid creating a second, divergent pagination model.

## Hard boundaries (if kept)

- Should hold only pure, dependency-light result shapes/helpers (depend on `types` at most), not a
  parallel query engine.

## Public API surface

- None yet.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/pagination/` — implement-vs-retire / fold-into-query
decision.

## Validation

```bash
pnpm --filter @ts-linq/pagination typecheck
pnpm --filter @ts-linq/pagination lint
pnpm --filter @ts-linq/pagination build
```

## Do / Don't

- **Do** reconcile with `query`'s existing pagination before writing code.
- **Don't** introduce a competing pagination API.
