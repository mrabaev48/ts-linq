/**
 * PostgreSQL error codes that represent transient conditions safe to retry.
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_TRANSIENT_ERROR_CODES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03' // cannot_connect_now
]);

/** Returns true if the given PostgreSQL error code is a transient condition. */
export function isPgTransientErrorCode(code: string | undefined): boolean {
  return code !== undefined && PG_TRANSIENT_ERROR_CODES.has(code);
}
