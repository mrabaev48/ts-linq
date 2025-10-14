import type {
  QueryFallback,
  FallbackRequest,
  SqlParameter,
  FreshnessConstraints
} from '../../types';
import type { DatabaseProvider } from '../../DatabaseProvider';

/** Read-only replica fallback using another DatabaseProvider. */
export class ReplicaFallback<T> implements QueryFallback<T> {
  public readonly label: string = 'replica';
  private readonly replica: DatabaseProvider;
  private readonly freshness?: FreshnessConstraints;
  private readonly serverCountPreferred: boolean;

  constructor(
    replica: DatabaseProvider,
    options?: { freshness?: FreshnessConstraints; serverCountPreferred?: boolean }
  ) {
    this.replica = replica;
    this.freshness = options?.freshness;
    this.serverCountPreferred = options?.serverCountPreferred ?? true;
  }

  public async fetch(request: FallbackRequest<T>): Promise<ReadonlyArray<T> | null> {
    // Freshness guard (best-effort): if provider exposes lag metric via logger/labels, we could query it.
    // Here we assume provider respects read-only and health internally.
    if (this.freshness?.requireReadOnly) {
      // no-op placeholder: concrete providers can enforce read-only at pool/connection level
    }
    const rows = await this.replica.executeQuery<Record<string, unknown>>(
      request.sql,
      request.params
    );
    // This fallback only knows raw rows; Queryable will materialize client-side if needed.
    // We return objects as T via unknown cast; mapping is applied later.
    return rows as unknown as ReadonlyArray<T>;
  }

  public async fetchCount(request: FallbackRequest<T>): Promise<number | null> {
    if (!this.serverCountPreferred) return null;
    // naive detection: try to transform SELECT ... FROM <table> [WHERE ...] → SELECT COUNT(*) FROM <table> [WHERE ...]
    const up = request.sql.toUpperCase();
    const fromIdx = up.indexOf(' FROM ');
    if (fromIdx <= 0) return null;
    const whereIdx = up.indexOf(' WHERE ');
    const tail = whereIdx > 0 ? request.sql.slice(fromIdx) : request.sql.slice(fromIdx);
    const countSql = `SELECT COUNT(*) as count${request.sql.slice(fromIdx)}`;
    try {
      const rows = await this.replica.executeQuery<{ count: number }>(countSql, request.params);
      const n = rows[0]?.count;
      return typeof n === 'number' ? n : null;
    } catch {
      return null;
    }
  }
}
