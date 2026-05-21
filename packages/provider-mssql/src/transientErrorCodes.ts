/**
 * SQL Server error numbers that represent transient conditions safe to retry.
 * Reference: https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues
 */
export const MSSQL_TRANSIENT_ERROR_NUMBERS = new Set([
  1205, // Deadlock victim
  1222, // Lock request timeout exceeded
  49918, // Cannot process request — not enough resources
  49919, // Cannot process create or update request — too many operations in progress
  49920, // Cannot process request — too many operations in progress
  4060, // Cannot open database
  40197, // Error processing request
  40501, // Service busy (throttling)
  40613, // Database not currently available
  10928, // Resource limit reached
  10929, // Resource limit reached
  10053, // Transport-level error
  10054, // Connection forcibly closed
  10060 // Connection timeout
]);

/** Returns true if the given SQL Server error number is a transient condition. */
export function isMssqlTransientErrorNumber(number: number | undefined): boolean {
  return number !== undefined && MSSQL_TRANSIENT_ERROR_NUMBERS.has(number);
}
