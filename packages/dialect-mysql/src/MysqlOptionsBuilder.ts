import { DialectOptionsBuilder } from '@ts-linq/dialect-kit';

/**
 * Per-dialect option builder for MySQL.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseMySql(conn, my => my.MaxBatchSize(50))`
 *
 * Usage:
 *   const opts = new MysqlOptionsBuilder().maxBatchSize(50).build();
 *   // pass opts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 *
 * The behaviour lives in the shared {@link DialectOptionsBuilder}; this subclass exists only to
 * keep the MySQL-specific published name (and `instanceof`) stable.
 */
export class MysqlOptionsBuilder extends DialectOptionsBuilder {}
