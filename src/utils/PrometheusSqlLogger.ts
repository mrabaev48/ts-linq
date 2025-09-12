import type { SqlLogger, SqlParameter } from '../types';

type LabelValues = Record<string, string>;

/** Minimal shape we rely on from prom-client. */
interface PromCounter {
  labels(labels: LabelValues): { inc: (v?: number) => void };
}
interface PromHistogram {
  labels(labels: LabelValues): { observe: (v: number, exemplar?: Record<string, unknown>) => void };
}
interface PromClientLike {
  Counter: new (cfg: Record<string, unknown>) => PromCounter;
  Histogram: new (cfg: Record<string, unknown>) => PromHistogram;
  Gauge?: new (cfg: Record<string, unknown>) => PromGauge;
}

interface PromGauge {
  inc: (labels?: LabelValues, v?: number) => void;
  dec: (labels?: LabelValues, v?: number) => void;
  set?: (labels: LabelValues, v: number) => void;
}

/**
 * Options for configuring PrometheusSqlLogger.
 *
 * - prefix: optional metric name prefix (e.g., "tsl_")
 * - bucketsMs: custom histogram buckets in milliseconds
 * - client: optional prom-client compatible object for DI/testing; if omitted, logger lazy-requires 'prom-client'
 */
export interface PrometheusLoggerOptions {
  /** Metric names prefix, e.g., "tsl_". */
  prefix?: string;
  /** Histogram buckets (ms) for query duration metric. */
  bucketsMs?: number[];
  /** Prometheus client to use; when omitted a lazy require('prom-client') is attempted. */
  client?: PromClientLike; // for tests/mocking; if omitted we lazy-require('prom-client')
}

/**
 * Prometheus-backed SqlLogger. No hard dependency on prom-client; works as no-op when not present.
 */
/**
 * Prometheus-backed SqlLogger implementation.
 *
 * Usage:
 * ```ts
 * import { PrometheusSqlLogger } from 'ts-linq';
 * const logger = new PrometheusSqlLogger('orders-service', { prefix: 'tsl_' });
 * const ctx = new AppDbContext({ provider: 'sqlite', connectionString: ':memory:', logger });
 * ```
 *
 * Emitted metrics (label schema kept low-cardinality):
 * - db_query_total (Counter) — { provider, operation, entity, success }
 * - db_query_duration_ms (Histogram) — { provider, operation, entity, success }
 * - db_error_total (Counter) — { provider, operation, entity, error_type }
 *
 * Note: Provider and entity are parsed best-effort from SQL; provider label defaults to "unknown".
 * If 'prom-client' is not installed, the logger becomes a no-op.
 */
export class PrometheusSqlLogger implements SqlLogger {
  private enabled: boolean = false;
  private prefix: string;
  private client?: PromClientLike;
  private queryTotal?: PromCounter;
  private queryDuration?: PromHistogram;
  private errorTotal?: PromCounter;
  private retryTotal?: PromCounter;
  private activeTransactions?: {
    inc: (labels?: LabelValues, v?: number) => void;
    dec: (labels?: LabelValues, v?: number) => void;
  };
  private cacheHits?: PromCounter;
  private cacheMisses?: PromCounter;
  private cacheSizeGauge?: PromGauge;
  private countCacheTtlHits?: PromCounter;
  private countCacheHardHits?: PromCounter;
  private cacheEvictions?: PromCounter;

  /**
   * Create a new PrometheusSqlLogger.
   * @param namespace Logical service name (reserved for future labels/exemplars).
   * @param options Optional configuration for metric prefix, buckets and DI client.
   */
  constructor(namespace: string, options?: PrometheusLoggerOptions) {
    this.prefix = options?.prefix ?? '';
    this.client = options?.client ?? this.safeRequirePromClient();
    if (!this.client) return;
    this.enabled = true;
    const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    const labelNames = ['provider', 'operation', 'entity', 'success'];
    this.queryTotal = new this.client.Counter({
      name: `${this.prefix}db_query_total`,
      help: 'Total DB queries',
      labelNames
    });
    this.queryDuration = new this.client.Histogram({
      name: `${this.prefix}db_query_duration_ms`,
      help: 'DB query duration (ms)',
      labelNames,
      buckets
    });
    this.errorTotal = new this.client.Counter({
      name: `${this.prefix}db_error_total`,
      help: 'Total DB errors',
      labelNames: ['provider', 'operation', 'entity', 'error_type']
    });
    this.retryTotal = new this.client.Counter({
      name: `${this.prefix}db_retry_total`,
      help: 'Total DB retry attempts',
      labelNames: ['provider', 'operation', 'entity']
    });
    if (this.client.Gauge) {
      const gauge = new this.client.Gauge({
        name: `${this.prefix}db_active_transactions`,
        help: 'Active DB transactions',
        labelNames: ['provider']
      });
      this.activeTransactions = {
        inc: (labels?: LabelValues, v?: number) => {
          try {
            gauge.inc(labels, v);
          } catch {
            /* ignore */
          }
        },
        dec: (labels?: LabelValues, v?: number) => {
          try {
            gauge.dec(labels, v);
          } catch {
            /* ignore */
          }
        }
      };
    }
    // optional cache metrics (off by default unless used)
    this.cacheHits = new this.client.Counter({
      name: `${this.prefix}db_cache_hits_total`,
      help: 'DB cache hits',
      labelNames: ['cache', 'provider']
    });
    this.cacheMisses = new this.client.Counter({
      name: `${this.prefix}db_cache_misses_total`,
      help: 'DB cache misses',
      labelNames: ['cache', 'provider']
    });
    // optional detailed counters for count cache
    this.countCacheTtlHits = new this.client.Counter({
      name: `${this.prefix}db_count_cache_ttl_hits_total`,
      help: 'Count cache TTL hits',
      labelNames: ['provider']
    });
    this.countCacheHardHits = new this.client.Counter({
      name: `${this.prefix}db_count_cache_hard_hits_total`,
      help: 'Count cache hard hits (external or no TTL)',
      labelNames: ['provider']
    });
    if (this.client.Gauge) {
      this.cacheSizeGauge = new this.client.Gauge({
        name: `${this.prefix}db_cache_size`,
        help: 'DB cache size (items)',
        labelNames: ['cache', 'provider']
      });
    }
    this.cacheEvictions = new this.client.Counter({
      name: `${this.prefix}db_cache_evictions_total`,
      help: 'DB cache evictions due to capacity limits',
      labelNames: ['cache', 'provider']
    });
  }

  /** No-op (metrics are recorded on queryEnd). */
  public queryStart(_info?: {
    sql: string;
    params: readonly SqlParameter[];
    traceId?: string;
    provider?: string;
  }): void {
    // Intentionally empty: we record on queryEnd with duration.
  }

  /** Record query counters and durations, and errors if present. */
  public queryEnd(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
    provider?: string;
  }): void {
    if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration) return;
    const op = this.parseOperation(info.sql);
    const entity = this.parseEntity(info.sql) || 'unknown';
    const provider = info.provider || 'unknown';
    const success = info.error ? 'false' : 'true';
    const labels = { provider, operation: op, entity, success } as LabelValues;
    try {
      this.queryTotal.labels(labels).inc(1);
      // Attach exemplar when traceId is present and prom-client supports it
      const duration = Math.max(0, info.durationMs);
      try {
        this.queryDuration
          .labels(labels)
          .observe(
            duration,
            info.traceId
              ? { traceId: info.traceId }
              : (undefined as unknown as Record<string, unknown>)
          );
      } catch {
        this.queryDuration.labels(labels).observe(duration);
      }
      if (info.error && this.errorTotal) {
        const errLabels = {
          provider,
          operation: op,
          entity,
          error_type: info.error.name || 'Error'
        } as LabelValues;
        this.errorTotal.labels(errLabels).inc(1);
      }
    } catch {
      /* swallow metric errors */
    }
  }

  /** Record a retry attempt. */
  public retry?(info: {
    sql: string;
    params: readonly SqlParameter[];
    attempt: number;
    traceId?: string;
    provider?: string;
  }): void {
    if (!this.enabled || !this.client || !this.retryTotal) return;
    const op = this.parseOperation(info.sql);
    const entity = this.parseEntity(info.sql) || 'unknown';
    const provider = info.provider || 'unknown';
    try {
      this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
    } catch {
      /* ignore */
    }
  }

  /** Track active transactions gauge. */
  public transactionStart?(info: { traceId?: string; provider?: string }): void {
    if (!this.enabled || !this.activeTransactions) return;
    const provider = info.provider || 'unknown';
    try {
      this.activeTransactions.inc({ provider }, 1);
    } catch {
      /* ignore */
    }
  }
  public transactionEnd?(info: { traceId?: string; provider?: string }): void {
    if (!this.enabled || !this.activeTransactions) return;
    const provider = info.provider || 'unknown';
    try {
      this.activeTransactions.dec({ provider }, 1);
    } catch {
      /* ignore */
    }
  }

  /** Cache hit/miss hook. */
  public cache?(info: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
  }): void {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      if (info.hit) this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
      else this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
      if (info.cache === 'count' && info.hit) {
        const ttl = (info as unknown as { ttl?: boolean }).ttl;
        if (ttl === true) this.countCacheTtlHits?.labels({ provider }).inc(1);
        else if (ttl === false) this.countCacheHardHits?.labels({ provider }).inc(1);
      }
    } catch {
      /* ignore */
    }
  }

  /** Cache size setter (optional API, used via duck typing). */
  public cacheSize?(info: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    size: number;
    provider?: string;
  }): void {
    if (!this.enabled || !this.cacheSizeGauge) return;
    const provider = info.provider || 'unknown';
    try {
      this.cacheSizeGauge?.set?.({ cache: info.cache, provider }, info.size);
    } catch {
      /* ignore */
    }
  }

  /** Eviction counter (optional API, used via duck typing). */
  public cacheEvicted?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }): void {
    if (!this.enabled || !this.cacheEvictions) return;
    const provider = info.provider || 'unknown';
    try {
      this.cacheEvictions.labels({ cache: info.cache, provider }).inc(1);
    } catch (e) {
      try {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('cacheEvicted', e);
      } catch {
        /* ignore */
      }
    }
  }

  private safeRequirePromClient(): PromClientLike | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pc = require('prom-client');
      if (pc && pc.Counter && pc.Histogram) {
        return pc as PromClientLike;
      }
    } catch {
      /* not installed */
    }
    return undefined;
  }

  private parseOperation(sql: string): string {
    const match = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
    return match ? match[1].toUpperCase() : 'OTHER';
  }

  private parseEntity(sql: string): string | undefined {
    const up = sql.toUpperCase();
    // FROM table or INTO table
    let match = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
    if (match && match[1]) return this.cleanIdentifier(match[1]);
    match = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
    if (match && match[1]) return this.cleanIdentifier(match[1]);
    // UPDATE table SET
    match = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
    if (match && match[1]) return this.cleanIdentifier(match[1]);
    return undefined;
  }

  private cleanIdentifier(id: string): string {
    return id.replace(/^["`\[]|["`\]]$/g, '');
  }
}
