# CLAUDE.md — @ts-linq/eslint-config

## Role

The **single shared ESLint flat-config** for the monorepo. Changing it affects every package's lint.

## Hard boundaries

- No `@ts-linq/*` dependencies. Pure tooling config.
- **Excluded from changesets** — never create a changeset here.

## Critical invariants & known hazards

- The `@typescript-eslint/no-unsafe-*` family currently does **not** reach `error` level, so unsafe
  `any` usage slips through across the repo. Promoting these to `error` is a known refactor (config
  task below) — do it in a staged way (the codebase has many violations to fix first).
- A config change can break CI for all packages at once — run `pnpm lint` at the root after editing.

## Public API surface

- `index.mjs` default export (the flat-config factory). Keep it backward compatible for consumers.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/eslint-config/` — promote bug-hiding rules to error
(staged), fix any rule drift.

## Validation

```bash
pnpm lint           # run at repo root after any change here
```

## Do / Don't

- **Do** stage stricter rules and fix violations alongside.
- **Don't** loosen rules to make CI green; don't create changesets here.
