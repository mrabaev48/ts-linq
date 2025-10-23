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

type MemoryProfilerLike = {
  onSample(
    listener: (s: {
      timestampMs: number;
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
      heapPressure: number;
    }) => void
  ): () => void;
  getAliveAllocations?(): number;
};

export interface PrometheusLoggerOptions {
  prefix?: string;
  bucketsMs?: number[];
  client?: PromClientLike;
  /** When true, redact string literals and sensitive patterns from SQL before parsing labels */
  maskSql?: boolean;
  /** Custom patterns to redact from SQL text (replaced by [REDACTED]) */
  maskPatterns?: ReadonlyArray<RegExp>;
  /** Optional memory profiling integration */
  memory?: {
    profiler?: MemoryProfilerLike;
  };
}

export class PrometheusSqlLogger implements SqlLogger {
  private enabled = false;
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
  private connectionHealthGauge?: PromGauge;
  private connectionLatency?: PromHistogram;
  private connectionDegradedGauge?: PromGauge;
  private connectionStatusTransitions?: PromCounter;
  private lastConnectionStatus: Map<string, string> = new Map();
  private maskSql: boolean = false;
  private maskPatterns: ReadonlyArray<RegExp> = [];
  private circuitTransitions?: PromCounter;
  private circuitOpenTotal?: PromCounter;
  private circuitStateGauge?: PromGauge;
  private circuitHalfOpenInFlight?: PromGauge;
  private circuitFailuresGauge?: PromGauge;
  private fallbackAttempts?: PromCounter;
  private fallbackSuccess?: PromCounter;
  private fallbackFailures?: PromCounter;
  private fallbackThrottled?: PromCounter;
  private hedgedWins?: PromCounter;
  private analysisSlowTotal?: PromCounter;
  private analysisExplainedTotal?: PromCounter;
  private analysisDuration?: PromHistogram;
  // Memory metrics
  private memRssGauge?: PromGauge;
  private memHeapTotalGauge?: PromGauge;
  private memHeapUsedGauge?: PromGauge;
  private memExternalGauge?: PromGauge;
  private memArrayBuffersGauge?: PromGauge;
  private memHeapPressureGauge?: PromGauge;
  private memAliveAllocationsGauge?: PromGauge;
  private detachMemory?: () => void;

  constructor(namespace: string, options?: PrometheusLoggerOptions) {
    this.prefix = options?.prefix ?? '';
    this.client = options?.client ?? this.safeRequirePromClient();
    this.maskSql = !!options?.maskSql;
    this.maskPatterns = options?.maskPatterns ?? [];
    if (!this.client) return;
    this.enabled = true;
    const buckets = options?.bucketsMs ?? [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    this.initQueryMetrics(buckets);
    this.initCacheMetrics();
    this.initHealthMetrics(buckets);
    this.initCircuitMetrics();
    this.initFallbackMetrics();
    this.initAnalysisMetrics(buckets);
    this.initMemoryMetrics(options?.memory?.profiler);
  }

  private initQueryMetrics(buckets: number[]): void {
    const labelNames = ['provider', 'operation', 'entity', 'success'];
    this.queryTotal = new this.client!.Counter({
      name: `${this.prefix}db_query_total`,
      help: 'Total DB queries',
      labelNames
    });
    this.queryDuration = new this.client!.Histogram({
      name: `${this.prefix}db_query_duration_ms`,
      help: 'DB query duration (ms)',
      labelNames,
      buckets
    });
    this.errorTotal = new this.client!.Counter({
      name: `${this.prefix}db_error_total`,
      help: 'Total DB errors',
      labelNames: ['provider', 'operation', 'entity', 'error_type']
    });
    this.retryTotal = new this.client!.Counter({
      name: `${this.prefix}db_retry_total`,
      help: 'Total DB retry attempts',
      labelNames: ['provider', 'operation', 'entity']
    });
    if (this.client!.Gauge) {
      const gauge = new this.client!.Gauge({
        name: `${this.prefix}db_active_transactions`,
        help: 'Active DB transactions',
        labelNames: ['provider']
      });
      this.activeTransactions = {
        inc: (labels?: LabelValues, v?: number) => {
          try {
            gauge.inc(labels, v);
          } catch {}
        },
        dec: (labels?: LabelValues, v?: number) => {
          try {
            gauge.dec(labels, v);
          } catch {}
        }
      };
    }
  }

  private initCacheMetrics(): void {
    this.cacheHits = new this.client!.Counter({
      name: `${this.prefix}db_cache_hits_total`,
      help: 'DB cache hits',
      labelNames: ['cache', 'provider']
    });
    this.cacheMisses = new this.client!.Counter({
      name: `${this.prefix}db_cache_misses_total`,
      help: 'DB cache misses',
      labelNames: ['cache', 'provider']
    });
    this.countCacheTtlHits = new this.client!.Counter({
      name: `${this.prefix}db_count_cache_ttl_hits_total`,
      help: 'Count cache TTL hits',
      labelNames: ['provider']
    });
    this.countCacheHardHits = new this.client!.Counter({
      name: `${this.prefix}db_count_cache_hard_hits_total`,
      help: 'Count cache hard hits (external or no TTL)',
      labelNames: ['provider']
    });
    if (this.client!.Gauge) {
      this.cacheSizeGauge = new this.client!.Gauge({
        name: `${this.prefix}db_cache_size`,
        help: 'DB cache size (items)',
        labelNames: ['cache', 'provider']
      });
    }
    this.cacheEvictions = new this.client!.Counter({
      name: `${this.prefix}db_cache_evictions_total`,
      help: 'DB cache evictions due to capacity limits',
      labelNames: ['cache', 'provider']
    });
  }

  private initHealthMetrics(buckets: number[]): void {
    if (this.client!.Gauge) {
      this.connectionHealthGauge = new this.client!.Gauge({
        name: `${this.prefix}db_connection_health`,
        help: 'DB connection health status (1 healthy, 0 unhealthy)',
        labelNames: ['provider', 'status']
      });
      this.connectionDegradedGauge = new this.client!.Gauge({
        name: `${this.prefix}db_connection_degraded`,
        help: 'DB connection degraded status (1 degraded, 0 otherwise)',
        labelNames: ['provider']
      });
    }
    this.connectionLatency = new this.client!.Histogram({
      name: `${this.prefix}db_connection_latency_ms`,
      help: 'DB health-check ping latency (ms)',
      labelNames: ['provider', 'status'],
      buckets
    });
    this.connectionStatusTransitions = new this.client!.Counter({
      name: `${this.prefix}db_connection_status_transitions_total`,
      help: 'DB connection health status transitions',
      labelNames: ['provider', 'from', 'to']
    });
  }

  private initCircuitMetrics(): void {
    this.circuitTransitions = new this.client!.Counter({
      name: `${this.prefix}db_circuit_transitions_total`,
      help: 'DB circuit breaker state transitions',
      labelNames: ['provider', 'from', 'to']
    });
    this.circuitOpenTotal = new this.client!.Counter({
      name: `${this.prefix}db_circuit_open_total`,
      help: 'DB circuit opened events',
      labelNames: ['provider', 'reason']
    });
    if (this.client!.Gauge) {
      this.circuitStateGauge = new this.client!.Gauge({
        name: `${this.prefix}db_circuit_state`,
        help: 'DB circuit state (0 closed, 0.5 half-open, 1 open)',
        labelNames: ['provider']
      });
      this.circuitHalfOpenInFlight = new this.client!.Gauge({
        name: `${this.prefix}db_circuit_half_open_inflight`,
        help: 'DB circuit half-open in-flight probes',
        labelNames: ['provider']
      });
      this.circuitFailuresGauge = new this.client!.Gauge({
        name: `${this.prefix}db_circuit_failures`,
        help: 'DB circuit consecutive failures counter',
        labelNames: ['provider']
      });
    }
  }

  private initAnalysisMetrics(buckets: number[]): void {
    this.analysisSlowTotal = new this.client!.Counter({
      name: `${this.prefix}db_analysis_slow_total`,
      help: 'Total slow queries detected by analyzer',
      labelNames: ['provider', 'entity']
    });
    this.analysisExplainedTotal = new this.client!.Counter({
      name: `${this.prefix}db_analysis_explained_total`,
      help: 'Total queries with explain plan collected',
      labelNames: ['provider', 'entity']
    });
    this.analysisDuration = new this.client!.Histogram({
      name: `${this.prefix}db_analysis_duration_ms`,
      help: 'Observed duration of analyzed queries (ms)',
      labelNames: ['provider', 'entity'],
      buckets
    });
  }

  private initFallbackMetrics(): void {
    this.fallbackAttempts = new this.client!.Counter({
      name: `${this.prefix}db_fallback_attempts_total`,
      help: 'Total graceful-degradation fallback attempts',
      labelNames: ['provider', 'fallback']
    });
    this.fallbackSuccess = new this.client!.Counter({
      name: `${this.prefix}db_fallback_success_total`,
      help: 'Successful graceful-degradation fallbacks',
      labelNames: ['provider', 'fallback']
    });
    this.fallbackFailures = new this.client!.Counter({
      name: `${this.prefix}db_fallback_failures_total`,
      help: 'Failed graceful-degradation fallbacks',
      labelNames: ['provider', 'fallback', 'error_type']
    });
    this.fallbackThrottled = new this.client!.Counter({
      name: `${this.prefix}db_fallback_throttled_total`,
      help: 'Fallback attempts skipped due to throttling',
      labelNames: ['provider']
    });
    this.hedgedWins = new this.client!.Counter({
      name: `${this.prefix}db_hedged_wins_total`,
      help: 'Hedged requests where fallback beat primary',
      labelNames: ['provider', 'operation', 'fallback']
    });
  }

  private initMemoryMetrics(profiler?: MemoryProfilerLike): void {
    if (!this.client || !this.client.Gauge) return;
    // Gauges are process-wide; no labels to avoid duplication/cardinality
    this.memRssGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_rss_bytes`,
      help: 'Process RSS memory usage (bytes)'
    });
    this.memHeapTotalGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_heap_total_bytes`,
      help: 'V8 heap total (bytes)'
    });
    this.memHeapUsedGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_heap_used_bytes`,
      help: 'V8 heap used (bytes)'
    });
    this.memExternalGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_external_bytes`,
      help: 'External memory (bytes)'
    });
    this.memArrayBuffersGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_array_buffers_bytes`,
      help: 'ArrayBuffers memory (bytes)'
    });
    this.memHeapPressureGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_heap_pressure`,
      help: 'Heap pressure ratio (0..1)'
    });
    this.memAliveAllocationsGauge = new this.client.Gauge({
      name: `${this.prefix}db_memory_alive_allocations`,
      help: 'Tracked alive allocations (FinalizationRegistry-based)'
    });

    if (profiler) {
      this.detachMemory = profiler.onSample((s) => {
        try {
          this.memRssGauge?.set?.({}, s.rssBytes);
          this.memHeapTotalGauge?.set?.({}, s.heapTotalBytes);
          this.memHeapUsedGauge?.set?.({}, s.heapUsedBytes);
          this.memExternalGauge?.set?.({}, s.externalBytes);
          this.memArrayBuffersGauge?.set?.({}, s.arrayBuffersBytes);
          this.memHeapPressureGauge?.set?.({}, s.heapPressure);
          const alive =
            typeof profiler.getAliveAllocations === 'function'
              ? profiler.getAliveAllocations()
              : undefined;
          if (typeof alive === 'number') this.memAliveAllocationsGauge?.set?.({}, alive);
        } catch {}
      });
    }
  }

  public debug(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: Prometheus metrics don't log text messages
  }
  public info(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: Prometheus metrics don't log text messages
  }
  public warn(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: Prometheus metrics don't log text messages
  }
  public error(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: Prometheus metrics don't log text messages
  }

  public queryStart(_info?: {
    sql: string;
    params: readonly SqlParameter[];
    traceId?: string;
    provider?: string;
  }): void {}

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
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    const success = info.error ? 'false' : 'true';
    const labels = { provider, operation: op, entity, success } as LabelValues;
    try {
      this.queryTotal.labels(labels).inc(1);
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
    } catch {}
  }

  public retry?(info: {
    sql: string;
    params: readonly SqlParameter[];
    attempt: number;
    traceId?: string;
    provider?: string;
  }): void {
    if (!this.enabled || !this.client || !this.retryTotal) return;
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    try {
      this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
    } catch {}
  }

  public transactionStart?(info: { traceId?: string; provider?: string }): void {
    if (this.enabled && this.activeTransactions) {
      try {
        this.activeTransactions.inc({ provider: info.provider || 'unknown' }, 1);
      } catch {}
    }
  }
  public transactionEnd?(info: { traceId?: string; provider?: string }): void {
    if (this.enabled && this.activeTransactions) {
      try {
        this.activeTransactions.dec({ provider: info.provider || 'unknown' }, 1);
      } catch {}
    }
  }

  public cache?(info: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
  }): void {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      if (info.hit) this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
      else this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
      if (info.cache === 'count') {
        if (info.hit && info.ttl === true) this.countCacheTtlHits?.labels({ provider }).inc(1);
        if (info.hit && info.ttl === false) this.countCacheHardHits?.labels({ provider }).inc(1);
      }
    } catch {}
  }

  public cacheSize?(info: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    size: number;
    provider?: string;
  }): void {
    if (!this.enabled || !this.cacheSizeGauge) return;
    try {
      this.cacheSizeGauge?.set?.(
        { cache: info.cache, provider: info.provider || 'unknown' },
        info.size
      );
    } catch {}
  }

  public cacheEvicted?(info: { cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }): void {
    if (!this.enabled || !this.cacheEvictions) return;
    try {
      this.cacheEvictions
        .labels({ cache: info.cache, provider: info.provider || 'unknown' })
        .inc(1);
    } catch {}
  }

  public hedgedWin?(info: { provider?: string; operation: string; fallback: string }): void {
    if (!this.enabled || !this.client || !this.hedgedWins) return;
    try {
      this.hedgedWins
        .labels({
          provider: info.provider || 'unknown',
          operation: info.operation,
          fallback: info.fallback
        })
        .inc(1);
    } catch {}
  }

  public connectionHealth?(info: {
    healthy: boolean;
    latencyMs?: number;
    provider?: string;
    status?: string;
  }): void {
    if (!this.enabled || (!this.connectionHealthGauge && !this.connectionLatency)) return;
    const provider = info.provider || 'unknown';
    const status = info.status || (info.healthy ? 'healthy' : 'unhealthy');
    this.setHealthGauge(provider, status, info.healthy);
    this.observeHealthLatency(provider, status, info.latencyMs);
    this.setDegradedGauge(provider, status);
    this.recordStatusTransition(provider, status);
  }

  public circuit?(info: {
    state: 'closed' | 'open' | 'half-open';
    provider?: string;
    failures?: number;
    reason?: string;
    halfOpenInFlight?: number;
  }): void {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      const prev = this.lastConnectionStatus.get(`circuit:${provider}`);
      if (prev && prev !== info.state) {
        this.circuitTransitions?.labels({ provider, from: prev, to: info.state }).inc(1);
      }
      this.lastConnectionStatus.set(`circuit:${provider}`, info.state);
      if (info.state === 'open') {
        const reason = info.reason || 'unknown';
        this.circuitOpenTotal?.labels({ provider, reason }).inc(1);
      }
      // state gauge
      const v = info.state === 'open' ? 1 : info.state === 'half-open' ? 0.5 : 0;
      this.circuitStateGauge?.set?.({ provider }, v);
      if (typeof info.halfOpenInFlight === 'number') {
        this.circuitHalfOpenInFlight?.set?.({ provider }, info.halfOpenInFlight);
      }
      if (typeof info.failures === 'number') {
        this.circuitFailuresGauge?.set?.({ provider }, info.failures);
      }
    } catch {}
  }

  public fallback?(info: {
    provider?: string;
    fallback: string;
    attempted: boolean;
    succeeded?: boolean;
    error?: Error;
    throttled?: boolean;
    isStale?: boolean;
    asOf?: number;
    source?: string;
  }): void {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      if (info.throttled) {
        this.fallbackThrottled?.labels({ provider }).inc(1);
        return;
      }
      if (info.attempted)
        this.fallbackAttempts?.labels({ provider, fallback: info.fallback }).inc(1);
      if (info.succeeded === true) {
        this.fallbackSuccess?.labels({ provider, fallback: info.fallback }).inc(1);
      } else if (info.succeeded === false) {
        const errType = info.error?.name || 'Error';
        this.fallbackFailures
          ?.labels({ provider, fallback: info.fallback, error_type: errType })
          .inc(1);
      }
    } catch {}
  }

  private setHealthGauge(provider: string, status: string, healthy: boolean): void {
    try {
      if (this.connectionHealthGauge) {
        this.connectionHealthGauge.set?.({ provider, status }, healthy ? 1 : 0);
      }
    } catch {}
  }

  private observeHealthLatency(provider: string, status: string, latencyMs?: number): void {
    try {
      if (this.connectionLatency && typeof latencyMs === 'number') {
        this.connectionLatency.labels({ provider, status }).observe(Math.max(0, latencyMs));
      }
    } catch {}
  }

  private setDegradedGauge(provider: string, status: string): void {
    try {
      if (this.connectionDegradedGauge) {
        this.connectionDegradedGauge.set?.({ provider }, status === 'degraded' ? 1 : 0);
      }
    } catch {}
  }

  private recordStatusTransition(provider: string, status: string): void {
    try {
      if (!this.connectionStatusTransitions) return;
      const prev = this.lastConnectionStatus.get(provider);
      if (prev && prev !== status) {
        this.connectionStatusTransitions.labels({ provider, from: prev, to: status }).inc(1);
      }
      this.lastConnectionStatus.set(provider, status);
    } catch {}
  }

  private safeRequirePromClient(): PromClientLike | undefined {
    try {
      const pc = require('prom-client');
      if (pc && pc.Counter && pc.Histogram) return pc as PromClientLike;
    } catch {}
    return undefined;
  }
  private maskIfNeeded(sql: string): string {
    if (!this.maskSql) return sql;
    let s = sql;
    // redact single- and double-quoted strings using safe regexps (no unmatched groups)
    s = s.replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'").replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
    for (const re of this.maskPatterns) {
      try {
        s = s.replace(re, '[REDACTED]');
      } catch {}
    }
    return s;
  }
  private parseOperation(sql: string): string {
    const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
    return m ? m[1].toUpperCase() : 'OTHER';
  }
  private parseEntity(sql: string): string | undefined {
    const up = sql.toUpperCase();
    let m = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    return undefined;
  }

  public analysis?(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    provider?: string;
    slow?: boolean;
    explainPlan?: unknown;
    recommendations?: ReadonlyArray<string>;
  }): void {
    if (!this.enabled || !this.client) return;
    const sql = this.maskIfNeeded(info.sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    try {
      if (typeof info.durationMs === 'number' && this.analysisDuration) {
        this.analysisDuration.labels({ provider, entity }).observe(Math.max(0, info.durationMs));
      }
      if (info.slow) this.analysisSlowTotal?.labels({ provider, entity }).inc(1);
      if (info.explainPlan) this.analysisExplainedTotal?.labels({ provider, entity }).inc(1);
    } catch {}
  }
  private cleanIdentifier(id: string): string {
    return id.replace(/^["`\[]|["`\]]$/g, '');
  }
}
