import { DbUpdateException, OrmErrorCode, type OrmErrorOptions } from '@ts-linq/types';

import type { EntityEntry } from '../changetracker/EntityEntry';

/**
 * Thrown when `saveChanges` detects an optimistic-concurrency conflict. Extends the
 * canonical {@link DbUpdateException} so callers can branch on `e.code`
 * (`ORM_UPDATE_CONCURRENCY`) or `e instanceof OrmError`, and preserves the
 * originating provider failure via `cause`. Carries the failed {@link EntityEntry}
 * instances for inspection/retry.
 */
export class DbUpdateConcurrencyException extends DbUpdateException {
  public override readonly code = OrmErrorCode.DbUpdateConcurrency;
  readonly entries: EntityEntry[];

  constructor(message: string, entries: EntityEntry[], opts?: OrmErrorOptions) {
    super(message, opts);
    this.entries = entries;
  }
}
