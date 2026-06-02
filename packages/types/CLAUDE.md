# CLAUDE.md — @ts-linq/types

## Role

The **foundation** of the monorepo. Canonical location for all shared types, interfaces, and the
base error hierarchy. Every package imports from here; this package imports from nothing.

## Hard boundaries

- **Zero dependencies.** Never add a `dependencies` or `peerDependencies` entry. If you are
  tempted to import another `@ts-linq/*` package here, the type belongs there, not here.
- **No runtime code** beyond trivial, pure, dependency-free helpers (`ok`, `err`). No classes with
  behavior, no I/O, no side effects, no `console`.
- This is the only place a contract should be declared once and re-exported elsewhere — avoid
  duplicating these shapes in downstream packages (`SoftDeleteOptions`, `GlobalFilter`, and the
  telemetry info objects have been duplicated before; don't).

## Public API surface & stability

- The entire package is public API via `src/index.ts`. Treat every exported name as a contract.
- Changing a field's type, removing a field, or renaming an export is a **breaking change** →
  `major` changeset + migration notes. Adding an optional field is `minor`.
- Preserve inference: prefer precise unions and `interface` over widened types; avoid `any`
  (prefer `unknown`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/types/`:
- `task-1` / `task-3` — split the 1275-line barrel and enforce a public/internal boundary.
- `task-2` — establish the canonical, code-carrying error hierarchy here (typed codes, cause
  chains) so downstream packages stop hand-rolling `throw new Error(...)`.
- `task-4` — type-level test coverage for the public contracts.

## Validation

```bash
pnpm --filter @ts-linq/types typecheck
pnpm --filter @ts-linq/types lint
pnpm --filter @ts-linq/types build
```

A change here ripples across the whole monorepo — after editing, run `pnpm typecheck` and
`pnpm build` at the root to catch downstream breakage.

## Do / Don't

- **Do** keep types small, composable, and documented with TSDoc.
- **Do** add a changeset for any exported-symbol change.
- **Don't** introduce circular intent (a type here that only makes sense with a downstream class).
- **Don't** add runtime behavior or dependencies.
