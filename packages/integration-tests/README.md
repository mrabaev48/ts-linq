# @ts-linq/integration-tests

> Centralized integration tests for ts-linq — cross-package behavior verification.

This internal, non-published package holds integration tests that exercise multiple ts-linq packages
together (beyond a single package's unit tests but lighter than full end-to-end). It also contains
bundle/size tests.

## Structure

```
tests-new/        # current integration tests
size-tests/       # bundle-size / footprint tests
jest.config.js
jest.sequencer.js
```

## Running Tests

```bash
pnpm test
pnpm test:watch
```

> **Do not run integration tests in the background** — they may wait on resources and hang. Run in
> the foreground.

## Notes

- Internal package; **not published** and **excluded from changesets**.
- Use the test providers / harness from `@ts-linq/testkits` where a real DB is not required.
