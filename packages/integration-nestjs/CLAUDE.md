# CLAUDE.md — @ts-linq/integration-nestjs

## Role

Intended **NestJS integration** for ts-linq. Currently a **placeholder stub** with no
implementation.

## ⚠️ Status

- `src/index.ts` is empty/stub; `package.json` declares **no dependencies** (no NestJS, no
  `@ts-linq/orm`). Version is `2.0.0-alpha.1`.
- This is an **implement-vs-retire decision** (refactor task below). Don't document features that
  don't exist; don't assume consumers can use it.

## Hard boundaries (once implemented)

- Would depend on `@ts-linq/orm` + NestJS (as a peer). Keep framework glue thin; no ORM logic here.

## Public API surface

- None yet.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/integration-nestjs/` — decide implement vs remove.

## Validation

```bash
pnpm --filter @ts-linq/integration-nestjs typecheck
pnpm --filter @ts-linq/integration-nestjs lint
pnpm --filter @ts-linq/integration-nestjs build
```

## Do / Don't

- **Do** resolve the implement-vs-retire decision before adding surface area.
- **Don't** claim functionality that isn't there.
