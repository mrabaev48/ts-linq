# CLAUDE.md — @ts-linq/testkits

## Role

Shared **test utilities**: `TestProvider`/`MockProvider` (no real DB), `DatabaseHarness` (real-DB
contract tests), entity builders, fixtures, SQL snapshot matcher.

## Hard boundaries

- Depends on `types`, `core`, `metadata`; the three providers are **peer** deps (only needed for
  real-DB harness runs).
- This is a dev/test package — **excluded from changesets/publishing for consumers**, but it is
  imported by many unit tests, so treat its API as semi-stable for the repo's own tests.

## Critical invariants & known hazards

- **`TestProvider` uses a regex SQL engine (~632 LOC).** It approximates real SQL behavior, so it
  can drift from actual provider behavior and produce **false greens**. When a behavior depends on
  real SQL semantics, prefer the `DatabaseHarness` contract path. Decompose `TestProvider` and back
  it with a shared provider contract (refactor `task-2`/`task-1`).
- Keep `TestProvider`/`MockProvider` aligned with the real `DatabaseProvider` contract so tests
  don't pass against a mock that no real provider matches.

## Public API surface & stability

- Public via `src/index.ts`. Changes ripple into many test suites across the monorepo.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/testkits/` — contract-test harness, decompose
`TestProvider`, unify the provider interface.

## Validation

```bash
pnpm --filter @ts-linq/testkits typecheck
pnpm --filter @ts-linq/testkits lint
pnpm --filter @ts-linq/testkits build
```

## Do / Don't

- **Do** prefer `DatabaseHarness` contract tests for SQL-semantic behavior.
- **Do** keep mock/test providers faithful to the real contract.
- **Don't** rely on the regex engine for behavior it can't faithfully model.
