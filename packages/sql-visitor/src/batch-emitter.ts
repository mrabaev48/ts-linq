/**
 * Shared pure utilities for building batch SQL statements.
 * Used by dialect-specific batch-syntax modules (Postgres, MSSQL, MySQL).
 */

/**
 * Build a VALUES list of question-mark rows: "(?,?),(?,?),…"
 * Dialect packages convert `?` to their own placeholder style afterward.
 */
export function buildQuestionMarkRows(rowCount: number, colCount: number): string {
  const row = `(${Array.from({ length: colCount }, () => '?').join(',')})`;
  return Array.from({ length: rowCount }, () => row).join(',');
}

/**
 * Split an array into sub-arrays of at most `size` elements.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('chunkArray: size must be > 0');
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Calculate the maximum number of rows per batch statement given:
 *  - `paramsPerRow`  — number of bind parameters per entity row
 *  - `maxBatchSize`  — user-configured cap (from DbContextOptionsBuilder.maxBatchSize)
 *  - `paramLimit`    — dialect hard cap on total parameters per statement
 *
 * Returns at least 1 to avoid infinite loops on very wide rows.
 */
export function calcChunkSize(
  paramsPerRow: number,
  maxBatchSize: number,
  paramLimit: number
): number {
  if (paramsPerRow <= 0) return maxBatchSize;
  const byParamLimit = Math.floor(paramLimit / paramsPerRow);
  return Math.max(1, Math.min(maxBatchSize, byParamLimit));
}
