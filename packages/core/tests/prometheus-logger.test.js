'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const prometheus_sql_logger_1 = require('prometheus-sql-logger');
const hits = [];
const misses = [];
class FakeCounter {
  constructor(cfg) {
    this.name = cfg.name;
  }
  labels(lbl) {
    return {
      inc: (v) => {
        if (this.name.endsWith('db_cache_hits_total')) hits.push({ lbl, v: v ?? 1 });
        if (this.name.endsWith('db_cache_misses_total')) misses.push({ lbl, v: v ?? 1 });
      }
    };
  }
}
class FakeHistogram {
  constructor() {
    this.calls = [];
  }
  labels(lbl) {
    return { observe: (v) => this.calls.push({ lbl, v }) };
  }
}
class FakeGauge {
  constructor() {
    this.incCalls = [];
    this.decCalls = [];
  }
  inc(lbl, v) {
    this.incCalls.push({ lbl, v: v ?? 1 });
  }
  dec(lbl, v) {
    this.decCalls.push({ lbl, v: v ?? 1 });
  }
}
const fakeClient = {
  Counter: FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
};
describe('PrometheusSqlLogger', () => {
  it('increments counters and observes duration when client provided', () => {
    const logger = new prometheus_sql_logger_1.PrometheusSqlLogger('test', {
      client: fakeClient,
      prefix: 'tsl_'
    });
    const start = Date.now();
    logger.queryStart?.({ sql: 'SELECT * FROM "Users"', params: [], provider: 'sqlite' });
    logger.queryEnd?.({
      sql: 'SELECT * FROM "Users"',
      params: [],
      durationMs: Date.now() - start,
      provider: 'sqlite'
    });
    // No exceptions
  });
  it('no-ops when prom-client is not installed', () => {
    const logger = new prometheus_sql_logger_1.PrometheusSqlLogger('test');
    logger.queryStart?.({ sql: 'SELECT 1', params: [] });
    logger.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 5 });
  });
  it('records retry attempts and transaction gauge when Gauge available', () => {
    const logger = new prometheus_sql_logger_1.PrometheusSqlLogger('test', {
      client: fakeClient,
      prefix: 'tsl_'
    });
    logger.retry?.({ sql: 'SELECT * FROM X', params: [], attempt: 1, provider: 'postgresql' });
    logger.transactionStart?.({ provider: 'postgresql' });
    logger.transactionEnd?.({ provider: 'postgresql' });
  });
  it('records cache hits and misses via cache() hook', () => {
    const logger = new prometheus_sql_logger_1.PrometheusSqlLogger('test', {
      client: fakeClient,
      prefix: 'tsl_'
    });
    const hitsBefore = hits.length;
    const missesBefore = misses.length;
    logger.cache?.({ cache: 'count', hit: true, provider: 'sqlite' });
    logger.cache?.({ cache: 'entityL2', hit: false, provider: 'sqlite' });
    expect(hits.length).toBe(hitsBefore + 1);
    expect(misses.length).toBe(missesBefore + 1);
  });
});
//# sourceMappingURL=prometheus-logger.test.js.map
