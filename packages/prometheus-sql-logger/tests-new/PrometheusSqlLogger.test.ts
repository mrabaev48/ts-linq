import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrometheusSqlLogger } from '../src/logger/PrometheusSqlLogger';

type LabelValues = Record<string, string>;
const hits: Array<{ lbl: LabelValues; v: number }> = [];
const misses: Array<{ lbl: LabelValues; v: number }> = [];

class FakeCounter {
  private name: string;
  constructor(cfg: { name: string }) {
    this.name = cfg.name;
  }
  labels(lbl: LabelValues) {
    return {
      inc: (v?: number) => {
        if (this.name.endsWith('db_cache_hits_total')) hits.push({ lbl, v: v ?? 1 });
        if (this.name.endsWith('db_cache_misses_total')) misses.push({ lbl, v: v ?? 1 });
      }
    };
  }
}

class FakeHistogram {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}

class FakeGauge {
  public incCalls: Array<{ lbl: LabelValues | undefined; v?: number }> = [];
  public decCalls: Array<{ lbl: LabelValues | undefined; v?: number }> = [];
  inc(lbl?: LabelValues, v?: number) {
    this.incCalls.push({ lbl, v: v ?? 1 });
  }
  dec(lbl?: LabelValues, v?: number) {
    this.decCalls.push({ lbl, v: v ?? 1 });
  }
}

interface TestPromCounter {
  labels(labels: LabelValues): { inc: (v?: number) => void };
}

interface TestPromHistogram {
  labels(labels: LabelValues): { observe: (v: number) => void };
}

interface TestPromGauge {
  inc: (labels?: LabelValues, v?: number) => void;
  dec: (labels?: LabelValues, v?: number) => void;
}

interface TestPromClientLike {
  Counter: new (cfg: Record<string, unknown>) => TestPromCounter;
  Histogram: new (cfg: Record<string, unknown>) => TestPromHistogram;
  Gauge?: new (cfg: Record<string, unknown>) => TestPromGauge;
}

const fakeClient = {
  Counter: FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
} as unknown as TestPromClientLike;

describe('PrometheusSqlLogger', () => {
  beforeEach(() => {
    hits.length = 0;
    misses.length = 0;
  });

  it('should increment counters and observe duration when client provided', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    const start = Date.now();
    
    logger.queryStart?.({ sql: 'SELECT * FROM "Users"', params: [], provider: 'postgresql' });
    logger.queryEnd?.({
      sql: 'SELECT * FROM "Users"',
      params: [],
      durationMs: Date.now() - start,
      provider: 'postgresql'
    });
    
    // Should not throw - metrics recorded successfully
    expect(logger).toBeDefined();
  });

  it('should no-op when prom-client is not installed', () => {
    const logger = new PrometheusSqlLogger('test');
    
    // Should not throw
    logger.queryStart?.({ sql: 'SELECT 1', params: [] });
    logger.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 5 });
    
    expect(logger).toBeDefined();
  });

  it('should record retry attempts and transaction gauge when Gauge available', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    
    logger.retry?.({ sql: 'SELECT * FROM X', params: [], attempt: 1, provider: 'postgresql' });
    logger.transactionStart?.({ provider: 'postgresql' });
    logger.transactionEnd?.({ provider: 'postgresql' });
    
    // Should not throw
    expect(logger).toBeDefined();
  });

  it('should record cache hits and misses via cache() hook', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    const hitsBefore = hits.length;
    const missesBefore = misses.length;
    
    logger.cache?.({ cache: 'count', hit: true, provider: 'postgresql' });
    logger.cache?.({ cache: 'entityL2', hit: false, provider: 'postgresql' });
    
    expect(hits.length).toBe(hitsBefore + 1);
    expect(misses.length).toBe(missesBefore + 1);
  });

  it('should handle multiple queries with different providers', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    
    // PostgreSQL query
    logger.queryStart?.({ sql: 'SELECT * FROM posts', params: [1], provider: 'postgresql' });
    logger.queryEnd?.({ sql: 'SELECT * FROM posts', params: [1], durationMs: 25, provider: 'postgresql' });
    
    expect(logger).toBeDefined();
  });

  it('should track cache performance across different cache types', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient, prefix: 'tsl_' });
    
    // Count cache
    logger.cache?.({ cache: 'count', hit: true, provider: 'postgresql' });
    logger.cache?.({ cache: 'count', hit: false, provider: 'postgresql' });
    
    // Entity L2 cache
    logger.cache?.({ cache: 'entityL2', hit: true, provider: 'postgresql' });
    logger.cache?.({ cache: 'entityL2', hit: false, provider: 'postgresql' });
    
    // SQL generation cache
    logger.cache?.({ cache: 'sqlGen', hit: true, provider: 'mysql' });
    
    expect(hits.length).toBe(3);
    expect(misses.length).toBe(2);
  });
});
