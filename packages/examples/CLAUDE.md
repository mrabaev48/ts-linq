# CLAUDE.md — @ts-linq/examples

## Role

Runnable **example programs** for ts-linq: `crud.ts` (entity definition, connect, CRUD,
`saveChanges`) and `linq-queries.ts` (`where`/`orderBy`/`select`/pagination/`count`), both run
against a real PostgreSQL instance (`docker-compose.yml` at the repo root).

## Status

- Populated (refactor `task-1` decision: populate, not remove — see below). Version `1.0.0`.
- Built via `@ts-linq/transformer-morph` (`ts-linq-transform build`), not plain `tsc`, since
  `where(...)`/`select(...)` need the compile-time transformer to rewrite lambdas into their
  compiled AST form.

## Hard boundaries

- An examples package only **consumes** public APIs (`@ts-linq/orm`, providers, etc.). It must never
  be depended on by library packages.
- **Excluded from changesets** — never create a changeset here.

## Public API surface

- None — illustrative code only.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/examples/` — implement-vs-retire decision
(resolved: populated).

## Validation

```bash
pnpm --filter @ts-linq/examples typecheck
pnpm --filter @ts-linq/examples build
```

## Do / Don't

- **Do** use only public APIs in examples; keep them runnable and current.
- **Don't** let any library package depend on this; don't create changesets here.
