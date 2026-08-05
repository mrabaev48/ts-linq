import { DialectOptionsBuilder } from '@ts-linq/dialect-kit';

/**
 * Per-dialect option builder for PostgreSQL.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseNpgsql(conn, pg => pg.MaxBatchSize(100))`
 *
 * Usage:
 *   const pgOpts = new PostgresOptionsBuilder().maxBatchSize(100).build();
 *   // pass pgOpts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 *
 * The behaviour lives in the shared {@link DialectOptionsBuilder}; this subclass exists only to
 * keep the Postgres-specific published name (and `instanceof`) stable.
 */
export class PostgresOptionsBuilder extends DialectOptionsBuilder {}
