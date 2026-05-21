/**
 * MySQL error codes that represent transient conditions safe to retry.
 * Reference: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
 */
export const MYSQL_TRANSIENT_ERROR_CODES = new Set([
  1213, // ER_LOCK_DEADLOCK
  1205, // ER_LOCK_WAIT_TIMEOUT
  2013, // CR_SERVER_LOST
  2006, // CR_SERVER_GONE_ERROR
  1047 // ER_UNKNOWN_COM_ERROR (server restarting)
]);

/** Returns true if the given MySQL error number is a transient condition. */
export function isMysqlTransientErrorCode(errno: number | undefined): boolean {
  return errno !== undefined && MYSQL_TRANSIENT_ERROR_CODES.has(errno);
}
