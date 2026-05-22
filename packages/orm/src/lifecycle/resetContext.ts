import type { DbContext } from '../DbContext';

/**
 * Reset all mutable state on a `DbContext` so it can be safely re-used by a
 * subsequent unit-of-work without carrying over any tracked entities,
 * cached queries, or transaction artefacts.
 *
 * This is the canonical reset entry-point used by `DbContextPool` before
 * pushing an idle context back onto the stack.
 *
 * **What is cleared:**
 * - `ChangeTracker` — all tracked entity references and their snapshots.
 * - L2 entity / SQL / count caches — via `CacheCoordinator.clearAll()`.
 * - Transaction depth counter — resets nested-transaction bookkeeping.
 *
 * **What is NOT cleared:**
 * - The underlying database *connection* — the provider stays connected
 *   so the next checkout avoids a reconnect round-trip.
 * - Model metadata — entity type configurations are immutable and shared.
 * - Interceptors, soft-delete config, and other constructor-time options —
 *   these are invariant across the context lifetime.
 *
 * @param ctx - The context instance to reset.
 */
export function resetContext(ctx: DbContext): void {
  ctx.reset();
}
