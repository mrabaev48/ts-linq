---
"@ts-linq/core": patch
---

Consolidate retry policies to a single source of truth. The `ExponentialBackoffRetryPolicy`, `NoRetryPolicy`, and `FixedIntervalRetryPolicy` classes (and the `ExponentialBackoffOptions` interface) are now defined only in `@ts-linq/concurrency`; `@ts-linq/core` re-exports them from `core/src/utils/RetryPolicies.ts`. All existing import paths are preserved, and cross-package `instanceof` checks now hold because both entry points resolve to the same class identity.
