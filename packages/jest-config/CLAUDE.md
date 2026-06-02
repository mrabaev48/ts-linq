# CLAUDE.md — @ts-linq/jest-config

## Role

The **shared Jest config** + test transformer for the monorepo.

## Hard boundaries

- Pure tooling; no `@ts-linq/*` runtime deps.
- **Excluded from changesets** — never create a changeset here.

## Critical invariants & known hazards

- The `moduleNameMapper` must stay in sync with the actual set of `@ts-linq/*` packages. Known
  drift exists: a ghost `@ts-linq/config` alias and a **missing `@ts-linq/transformer`** mapping
  (config refactor task). Stale/missing aliases cause confusing test failures.
- A change here affects every package's test run — validate broadly.

## Public API surface

- `index.js` (config) + `jest-transformer.js`. Consumed by every package's `jest.config.js`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/jest-config/` — fix alias drift (remove ghost
`@ts-linq/config`, add `@ts-linq/transformer`), align mappings.

## Validation

```bash
pnpm tests:unit     # run at root after changes here
```

## Do / Don't

- **Do** keep `moduleNameMapper` exactly aligned with real packages.
- **Don't** leave ghost/missing aliases; don't create changesets here.
