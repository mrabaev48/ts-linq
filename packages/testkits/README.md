# @ts-linq/testkits

> Contract- and integration-test utilities for ts-linq: a regex-driven `TestProvider`, a mock
> provider, a database harness, entity builders, fixtures, and a SQL snapshot matcher.

These utilities let packages test query/ORM behavior without a real database (via `TestProvider` /
`MockProvider`) and let providers run shared contract tests against a real database (via
`DatabaseHarness`).

## Installation

```bash
pnpm add -D @ts-linq/testkits
```

## What lives here

- **`TestProvider`** (`TestProvider.ts`) — an in-memory `DatabaseProvider` with a regex SQL engine,
  used by many unit tests.
- **`MockProvider`** (`mocks/MockProvider.ts`) — a configurable mock provider.
- **`DatabaseHarness`** (`harness/DatabaseHarness.ts`) — spins up real-DB contract tests.
- **`EntityBuilder`** (`builders/EntityBuilder.ts`) — fluent test-entity construction.
- **`TestEntities`** (`fixtures/TestEntities.ts`) — shared fixture entities.
- **`SqlSnapshotMatcher`** (`snapshot/SqlSnapshotMatcher.ts`) — assert generated SQL via snapshots.

## Usage

```ts
import { TestProvider } from '@ts-linq/testkits';

const provider = new TestProvider();
// drive Queryable/DbContext without a real DB
```

## Package structure

```
src/
  TestProvider.ts
  mocks/MockProvider.ts
  harness/DatabaseHarness.ts
  builders/EntityBuilder.ts
  fixtures/TestEntities.ts
  snapshot/SqlSnapshotMatcher.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`, `@ts-linq/core`, `@ts-linq/metadata`
- Peer: `@ts-linq/provider-postgres`, `@ts-linq/provider-mysql`, `@ts-linq/provider-mssql`

## License

Part of the ts-linq monorepo. See the repository root for license details.
