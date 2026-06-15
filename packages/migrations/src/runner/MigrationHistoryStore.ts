/**
 * A record stored in the migrations bookkeeping table representing an applied migration.
 */
export interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: Date;
}

/**
 * Repository port over the migration bookkeeping table (`__migrations`).
 *
 * Isolates all persistence — table DDL, placeholder style, dialect quoting — behind a stable
 * interface so the {@link MigrationRunner} orchestrates against an abstraction (DIP) and can be
 * unit-tested with an in-memory fake. The default provider-backed implementation is
 * {@link DefaultMigrationHistoryStore}.
 */
export interface MigrationHistoryStore {
  /** Idempotently ensures the bookkeeping table exists. Safe to call repeatedly. */
  ensureExists(): Promise<void>;

  /**
   * Returns the applied migrations ordered by version.
   *
   * Returns `[]` only when the bookkeeping table is genuinely absent. A query failure against an
   * existing table propagates rather than being swallowed — a connection/permission error must
   * never masquerade as "no migrations applied" (which would re-run already-applied migrations).
   */
  list(): Promise<MigrationRecord[]>;

  /** Records a successfully applied migration. */
  record(version: string, name: string, appliedAt: Date): Promise<void>;

  /** Removes the bookkeeping record for a rolled-back migration. */
  remove(version: string): Promise<void>;
}
