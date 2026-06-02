# CLAUDE.md — @ts-linq/integration-tests

## Role

Centralized **cross-package integration tests** + bundle-size tests. Internal, not published.

## Hard boundaries

- May depend on any runtime package.
- **Excluded from changesets** — never create a changeset here.

## Critical operational rules

- **Do not run in the background** — integration runs can hang waiting on resources; run in the
  foreground and let the user kill if needed.
- Prefer `@ts-linq/testkits` providers/harness when a real DB isn't strictly required.
- Keep tests deterministic and isolated.

## Public API surface

- None — tests only (`tests-new/`, `size-tests/`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/integration-tests/` — structure/coverage cleanup
(note the `tests-new/` naming suggests an unfinished migration of the suite).

## Validation

```bash
pnpm --filter @ts-linq/integration-tests lint
pnpm --filter @ts-linq/integration-tests test   # foreground only
```

## Do / Don't

- **Do** run in the foreground; keep tests isolated.
- **Don't** create changesets; don't background the run.
