# CLAUDE.md — @ts-linq/examples

## Role

Runnable **example programs** for ts-linq. Currently a **placeholder stub**.

## ⚠️ Status

- `src/index.ts` is a stub; no dependencies declared; version `2.0.0-alpha.1`.
- Decide whether to populate with real examples or remove (refactor task below).

## Hard boundaries

- An examples package only **consumes** public APIs (`@ts-linq/orm`, providers, etc.). It must never
  be depended on by library packages.
- **Excluded from changesets** — never create a changeset here.

## Public API surface

- None — illustrative code only.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/examples/` — implement-vs-retire decision.

## Validation

```bash
pnpm --filter @ts-linq/examples typecheck
pnpm --filter @ts-linq/examples build
```

## Do / Don't

- **Do** use only public APIs in examples; keep them runnable and current.
- **Don't** let any library package depend on this; don't create changesets here.
