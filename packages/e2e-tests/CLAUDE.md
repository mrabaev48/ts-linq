# CLAUDE.md — @ts-linq/e2e-tests

## Role

End-to-end test suite exercising the **full stack against real databases**. Internal, not
published.

## Hard boundaries

- May depend on any runtime package (it sits at the very top of the graph).
- **Excluded from changesets** — never create a changeset targeting this package.

## Critical operational rules

- **NEVER run these tests in the background.** They wait on live DBs (Docker) and hang; they have to
  be killed manually. Run only in the foreground.
- Tests need real Postgres/MySQL/MSSQL (or `SKIP_DB_TESTS=1`). Provide connection strings via env.
- Keep tests isolated (`beforeEach`/`afterEach`, fresh context) — no cross-test state.

## Public API surface

- None. This package exports nothing; it only contains tests + setup (`setup.ts`,
  `jest-transformer.js`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/e2e-tests/` — coverage/structure improvements.

## Validation

```bash
pnpm --filter @ts-linq/e2e-tests lint
pnpm --filter @ts-linq/e2e-tests test        # foreground only, needs live DBs
```

## Do / Don't

- **Do** run in the foreground; keep tests isolated.
- **Don't** create changesets here; don't background the test run.
