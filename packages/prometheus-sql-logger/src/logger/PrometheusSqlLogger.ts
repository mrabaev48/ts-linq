import type { SqlLogger, SqlParameter } from '@ts-linq/core';

type LabelValues = Record<string, string>;

interface PromCounter {
  labels(labels: LabelValues): { inc: (v?: number) => void };
}
interface PromHistogram {
  labels(labels: LabelValues): { observe: (v: number, exemplar?: Record<string, unknown>) => void };
}
interface PromGauge {
  inc: (labels?: LabelValues, v?: number) => void;
  dec: (labels?: LabelValues, v?: number) => void;
  set?: (labels: LabelValues, v: number) => void;
}
interface PromClientLike {
  Counter: new (cfg: Record<string, unknown>) => PromCounter;
  Histogram: new (cfg: Record<string, unknown>) => PromHistogram;
  Gauge?: new (cfg: Record<string, unknown>) => PromGauge;
}

export interface PrometheusLoggerOptions {
  prefix?: string;
  bucketsMs?: number[];
  client?: PromClientLike;
  /** When true, redact string literals and sensitive patterns from SQL before parsing labels */
  maskSql?: boolean;
  /** Custom patterns to redact from SQL text (replaced by [REDACTED]) */
  maskPatterns?: ReadonlyArray<RegExp>;
}

export class PrometheusSqlLogger implements SqlLogger {
  private enabled = false;
  private prefix: string;
  private client?: PromClientLike;
  private queryTotal?: PromCounter;
  private queryDuration?: PromHistogram;
  private errorTotal?: PromCounter;
  private retryTotal?: PromCounter;
  private activeTransactions?: { inc: (labels?: LabelValues, v?: number) => void; dec: (labels?: LabelValues, v?: number) => void };
  private cacheHits?: PromCounter;
  private cacheMisses?: PromCounter;
  private cacheSizeGauge?: PromGauge;
  private countCacheTtlHits?: PromCounter;
  private countCacheHardHits?: PromCounter;
  private cacheEvictions?: PromCounter;
  private maskSql: boolean = false;
  private maskPatterns: ReadonlyArray<RegExp> = [];

  constructor(namespace: string, options?: PrometheusLoggerOptions) {
    this.prefix = options?.prefix ?? '';
    this.client = options?.client ?? this.safeRequirePromClient();
    this.maskSql = !!options?.maskSql;
    this.maskPatterns = options?.maskPatterns ?? [];
    if (!this.client) return;
    this.enabled = true;
    const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    const labelNames = ['provider', 'operation', 'entity', 'success'];
    this.queryTotal = new this.client.Counter({ name: `${this.prefix}db_query_total`, help: 'Total DB queries', labelNames });
    this.queryDuration = new this.client.Histogram({ name: `${this.prefix}db_query_duration_ms`, help: 'DB query duration (ms)', labelNames, buckets });
    this.errorTotal = new this.client.Counter({ name: `${this.prefix}db_error_total`, help: 'Total DB errors', labelNames: ['provider', 'operation', 'entity', 'error_type'] });
    this.retryTotal = new this.client.Counter({ name: `${this.prefix}db_retry_total`, help: 'Total DB retry attempts', labelNames: ['provider', 'operation', 'entity'] });
    if (this.client.Gauge) {
      const gauge = new this.client.Gauge({ name: `${this.prefix}db_active_transactions`, help: 'Active DB transactions', labelNames: ['provider'] });
      this.activeTransactions = { inc: (labels?: LabelValues, v?: number) => { try { gauge.inc(labels, v); } catch {} }, dec: (labels?: LabelValues, v?: number) => { try { gauge.dec(labels, v); } catch {} } };
    }
    this.cacheHits = new this.client.Counter({ name: `${this.prefix}db_cache_hits_total`, help: 'DB cache hits', labelNames: ['cache', 'provider'] });
    this.cacheMisses = new this.client.Counter({ name: `${this.prefix}db_cache_misses_total`, help: 'DB cache misses', labelNames: ['cache', 'provider'] });
    this.countCacheTtlHits = new this.client.Counter({ name: `${this.prefix}db_count_cache_ttl_hits_total`, help: 'Count cache TTL hits', labelNames: ['provider'] });
    this.countCacheHardHits = new this.client.Counter({ name: `${this.prefix}db_count_cache_hard_hits_total`, help: 'Count cache hard hits (external or no TTL)', labelNames: ['provider'] });
    if (this.client.Gauge) {
      this.cacheSizeGauge = new this.client.Gauge({ name: `${this.prefix}db_cache_size`, help: 'DB cache size (items)', labelNames: ['cache', 'provider'] });
    }
    this.cacheEvictions = new this.client.Counter({ name: `${this.prefix}db_cache_evictions_total`, help: 'DB cache evictions due to capacity limits', labelNames: ['cache', 'provider'] });
  }

  public queryStart(_info?: { sql: string; params: readonly SqlParameter[]; traceId?: string; provider?: string }): void {}

  public queryEnd(info: { sql: string; params: readonly SqlParameter[]; durationMs: number; traceId?: string; rows?: number; error?: Error; provider?: string }): void {
    if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration) return;
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    const success = info.error ? 'false' : 'true';
    const labels = { provider, operation: op, entity, success } as LabelValues;
    try {
      this.queryTotal.labels(labels).inc(1);
      const duration = Math.max(0, info.durationMs);
      try { this.queryDuration.labels(labels).observe(duration, info.traceId ? { traceId: info.traceId } : (undefined as unknown as Record<string, unknown>)); } catch { this.queryDuration.labels(labels).observe(duration); }
      if (info.error && this.errorTotal) {
        const errLabels = { provider, operation: op, entity, error_type: info.error.name || 'Error' } as LabelValues;
        this.errorTotal.labels(errLabels).inc(1);
      }
    } catch {}
  }

  public retry?(info: { sql: string; params: readonly SqlParameter[]; attempt: number; traceId?: string; provider?: string }): void {
    if (!this.enabled || !this.client || !this.retryTotal) return;
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    try { this.retryTotal.labels({ provider, operation: op, entity }).inc(1); } catch {}
  }

  public transactionStart?(info: { traceId?: string; provider?: string }): void { if (this.enabled && this.activeTransactions) { try { this.activeTransactions.inc({ provider: info.provider || 'unknown' }, 1); } catch {} } }
  public transactionEnd?(info: { traceId?: string; provider?: string }): void { if (this.enabled && this.activeTransactions) { try { this.activeTransactions.dec({ provider: info.provider || 'unknown' }, 1); } catch {} } }

  public cache?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; hit: boolean; provider?: string }): void {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      if (info.hit) this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
      else this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
    } catch {}
  }

  public cacheSize?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; size: number; provider?: string }): void {
    if (!this.enabled || !this.cacheSizeGauge) return;
    try { this.cacheSizeGauge?.set?.({ cache: info.cache, provider: info.provider || 'unknown' }, info.size); } catch {}
  }

  public cacheEvicted?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }): void {
    if (!this.enabled || !this.cacheEvictions) return;
    try { this.cacheEvictions.labels({ cache: info.cache, provider: info.provider || 'unknown' }).inc(1); } catch {}
  }

  private safeRequirePromClient(): PromClientLike | undefined {
    try { const pc = require('prom-client'); if (pc && pc.Counter && pc.Histogram) return pc as PromClientLike; } catch {}
    return undefined;
  }
  private maskIfNeeded(sql: string): string {
    if (!this.maskSql) return sql;
    let s = sql;
    // redact single-quoted string literals
    s = s.replace(/'([^']|''))*'/g, `'[REDACTED]'`).replace(/"([^"\\]|\\.)*"/g, '"[REDACTED]"');
    for (const re of this.maskPatterns) {
      try { s = s.replace(re, '[REDACTED]'); } catch {}
    }
    return s;
  }
  private parseOperation(sql: string): string { const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i); return m ? m[1].toUpperCase() : 'OTHER'; }
  private parseEntity(sql: string): string | undefined {
    const up = sql.toUpperCase();
    let m = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/); if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/); if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/); if (m && m[1]) return this.cleanIdentifier(m[1]);
    return undefined;
  }
  private cleanIdentifier(id: string): string { return id.replace(/^["`\[]|["`\]]$/g, ''); }
}


