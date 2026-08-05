import { DialectOptionsBuilder } from '@ts-linq/dialect-kit';

/**
 * Per-dialect option builder for SQL Server.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseSqlServer(conn, sql => sql.MaxBatchSize(50))`
 *
 * Usage:
 *   const opts = new MssqlOptionsBuilder().maxBatchSize(50).build();
 *   // pass opts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 *
 * The behaviour lives in the shared {@link DialectOptionsBuilder}; this subclass exists only to
 * keep the SQL Server-specific published name (and `instanceof`) stable.
 */
export class MssqlOptionsBuilder extends DialectOptionsBuilder {}
