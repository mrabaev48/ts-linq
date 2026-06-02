# @ts-linq/concurrency

> Execution strategy and retry-policy primitives for resilient database access in ts-linq.

This package provides the building blocks for retrying transient database failures and wrapping
operations in a configurable execution strategy (retry counts, backoff, transient-error
classification).

## Installation

```bash
pnpm add @ts-linq/concurrency
```

## What lives here

- **`ExecutionStrategy`** (`ExecutionStrategy.ts`) — wraps an operation with retry/backoff and
  transient-failure handling.
- **Retry policies** (`RetryPolicies.ts`) — ready-made policies (fixed, exponential backoff, etc.)
  implementing the `RetryPolicy` contract from `@ts-linq/types`.

## Usage

```ts
import { ExecutionStrategy } from '@ts-linq/concurrency';

const result = await new ExecutionStrategy({ maxRetries: 3 })
  .execute(() => provider.query(sql, params));
```

## Package structure

```
src/
  ExecutionStrategy.ts
  RetryPolicies.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
