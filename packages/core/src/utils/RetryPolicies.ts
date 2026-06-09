// Single source of truth for retry policies lives in @ts-linq/concurrency.
// This module is a pure re-export facade kept for backward compatibility so
// existing import paths (`@ts-linq/core`, `./utils/RetryPolicies`) keep working
// and resolve to the exact same class identities (cross-package `instanceof`).
export {
  type ExponentialBackoffOptions,
  ExponentialBackoffRetryPolicy,
  FixedIntervalRetryPolicy,
  NoRetryPolicy
} from '@ts-linq/concurrency';
