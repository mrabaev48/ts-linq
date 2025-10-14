/** Read-only replica fallback using another DatabaseProvider. */
export class ReplicaFallback {
    constructor(replica, options) {
        this.label = 'replica';
        this.replica = replica;
        this.freshness = options?.freshness;
        this.serverCountPreferred = options?.serverCountPreferred ?? true;
    }
    async fetch(request) {
        // Freshness guard (best-effort): if provider exposes lag metric via logger/labels, we could query it.
        // Here we assume provider respects read-only and health internally.
        if (this.freshness?.requireReadOnly) {
            // no-op placeholder: concrete providers can enforce read-only at pool/connection level
        }
        const rows = await this.replica.executeQuery(request.sql, request.params);
        // This fallback only knows raw rows; Queryable will materialize client-side if needed.
        // We return objects as T via unknown cast; mapping is applied later.
        return rows;
    }
    async fetchCount(request) {
        if (!this.serverCountPreferred)
            return null;
        // naive detection: try to transform SELECT ... FROM <table> [WHERE ...] → SELECT COUNT(*) FROM <table> [WHERE ...]
        const up = request.sql.toUpperCase();
        const fromIdx = up.indexOf(' FROM ');
        if (fromIdx <= 0)
            return null;
        const whereIdx = up.indexOf(' WHERE ');
        const tail = whereIdx > 0 ? request.sql.slice(fromIdx) : request.sql.slice(fromIdx);
        const countSql = `SELECT COUNT(*) as count${request.sql.slice(fromIdx)}`;
        try {
            const rows = await this.replica.executeQuery(countSql, request.params);
            const n = rows[0]?.count;
            return typeof n === 'number' ? n : null;
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=ReplicaFallback.js.map