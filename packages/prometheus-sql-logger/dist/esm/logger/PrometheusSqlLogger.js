export class PrometheusSqlLogger {
  constructor(namespace, options) {
    this.enabled = false;
    this.maskSql = false;
    this.maskPatterns = [];
    this.prefix = options?.prefix ?? '';
    this.client = options?.client ?? this.safeRequirePromClient();
    this.maskSql = !!options?.maskSql;
    this.maskPatterns = options?.maskPatterns ?? [];
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
        inc: (labels, v) => {
          try {
            gauge.inc(labels, v);
          } catch {}
        },
        dec: (labels, v) => {
          try {
            gauge.dec(labels, v);
          } catch {}
        }
      };
    }
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
  queryStart(_info) {}
  queryEnd(info) {
    if (!this.enabled || !this.client || !this.queryTotal || !this.queryDuration) return;
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    const success = info.error ? 'false' : 'true';
    const labels = { provider, operation: op, entity, success };
    try {
      this.queryTotal.labels(labels).inc(1);
      const duration = Math.max(0, info.durationMs);
      try {
        this.queryDuration
          .labels(labels)
          .observe(duration, info.traceId ? { traceId: info.traceId } : undefined);
      } catch {
        this.queryDuration.labels(labels).observe(duration);
      }
      if (info.error && this.errorTotal) {
        const errLabels = {
          provider,
          operation: op,
          entity,
          error_type: info.error.name || 'Error'
        };
        this.errorTotal.labels(errLabels).inc(1);
      }
    } catch {}
  }
  retry(info) {
    if (!this.enabled || !this.client || !this.retryTotal) return;
    const sql = this.maskIfNeeded(info.sql);
    const op = this.parseOperation(sql);
    const entity = this.parseEntity(sql) || 'unknown';
    const provider = info.provider || 'unknown';
    try {
      this.retryTotal.labels({ provider, operation: op, entity }).inc(1);
    } catch {}
  }
  transactionStart(info) {
    if (this.enabled && this.activeTransactions) {
      try {
        this.activeTransactions.inc({ provider: info.provider || 'unknown' }, 1);
      } catch {}
    }
  }
  transactionEnd(info) {
    if (this.enabled && this.activeTransactions) {
      try {
        this.activeTransactions.dec({ provider: info.provider || 'unknown' }, 1);
      } catch {}
    }
  }
  cache(info) {
    if (!this.enabled || !this.client) return;
    const provider = info.provider || 'unknown';
    try {
      if (info.hit) this.cacheHits?.labels({ cache: info.cache, provider }).inc(1);
      else this.cacheMisses?.labels({ cache: info.cache, provider }).inc(1);
    } catch {}
  }
  cacheSize(info) {
    if (!this.enabled || !this.cacheSizeGauge) return;
    try {
      this.cacheSizeGauge?.set?.(
        { cache: info.cache, provider: info.provider || 'unknown' },
        info.size
      );
    } catch {}
  }
  cacheEvicted(info) {
    if (!this.enabled || !this.cacheEvictions) return;
    try {
      this.cacheEvictions
        .labels({ cache: info.cache, provider: info.provider || 'unknown' })
        .inc(1);
    } catch {}
  }
  safeRequirePromClient() {
    try {
      const pc = require('prom-client');
      if (pc && pc.Counter && pc.Histogram) return pc;
    } catch {}
    return undefined;
  }
  maskIfNeeded(sql) {
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
  parseOperation(sql) {
    const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
    return m ? m[1].toUpperCase() : 'OTHER';
  }
  parseEntity(sql) {
    const up = sql.toUpperCase();
    let m = up.match(/\bFROM\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/\bINTO\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    m = up.match(/^UPDATE\s+([A-Z0-9_"`\[\]]+)/);
    if (m && m[1]) return this.cleanIdentifier(m[1]);
    return undefined;
  }
  cleanIdentifier(id) {
    return id.replace(/^["`\[]|["`\]]$/g, '');
  }
}
//# sourceMappingURL=PrometheusSqlLogger.js.map
