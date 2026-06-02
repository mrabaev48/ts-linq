# CLAUDE.md — @ts-linq/typescript-config

## Role

The **shared TypeScript compiler configs** (`base.json`, `node.json`, `esm.json`) every package
extends.

## Hard boundaries

- Pure tooling; no runtime deps.
- **Excluded from changesets** — never create a changeset here.

## Critical invariants & known hazards

- `base.json` currently lacks **`noUncheckedIndexedAccess`** despite pervasive index access across
  the codebase — enabling it is a known refactor (config task) and must be staged because it will
  surface many real errors.
- A change to `base.json` reconfigures the whole monorepo's type checking — validate with a root
  `pnpm typecheck` before/after.

## Public API surface

- The three JSON configs are the contract. Removing/renaming one is breaking for every consumer.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/typescript-config/` — staged strictness rollout
(`noUncheckedIndexedAccess`, etc.).

## Validation

```bash
pnpm typecheck      # run at root after any change here
```

## Do / Don't

- **Do** roll out stricter flags in stages, fixing fallout as you go.
- **Don't** weaken strictness to silence errors; don't create changesets here.
