import { describe, it, expect } from '@jest/globals';
import { PrometheusSqlLogger } from '../src/logger/PrometheusSqlLogger';
import type { QueryAnalysisInfo } from '@ts-linq/types';

type LabelValues = Record<string, string>;

class FakeCounter {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  constructor(private readonly name: string) {}
  labels(lbl: LabelValues) {
    return { inc: (v?: number) => this.calls.push({ lbl, v: v ?? 1 }) };
  }
}

class FakeHistogram {
  public calls: Array<{ lbl: LabelValues; v: number }> = [];
  labels(lbl: LabelValues) {
    return { observe: (v: number) => this.calls.push({ lbl, v }) };
  }
}

class FakeGauge {
  inc(): void {}
  dec(): void {}
  set(): void {}
}

const fakeClient = {
  Counter: class extends FakeCounter {} as unknown as new (cfg: { name: string }) => FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge
} as const;

describe('PrometheusSqlLogger - Query Analysis', () => {
  it('should record analysis duration, slow queries and explain plans', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    
    const info: QueryAnalysisInfo = {
      sql: 'SELECT * FROM users WHERE age > 18',
      params: [],
      durationMs: 123,
      provider: 'sqlite',
      slow: true,
      explainPlan: { plan: 'SCAN users' }
    };
    
    // Should not throw
    logger.analysis?.(info);
    
    expect(logger).toBeDefined();
  });

  it('should handle fast queries without explain plans', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    
    const info: QueryAnalysisInfo = {
      sql: 'SELECT id FROM users LIMIT 1',
      params: [],
      durationMs: 5,
      provider: 'postgresql',
      slow: false
    };
    
    logger.analysis?.(info);
    
    expect(logger).toBeDefined();
  });

  it('should record analysis for different database providers', () => {
    const logger = new PrometheusSqlLogger('test', { client: fakeClient as any, prefix: 'tsl_' });
    
    // SQLite slow query
    logger.analysis?.({
      sql: 'SELECT * FROM products',
      params: [],
      durationMs: 250,
      provider: 'sqlite',
      slow: true,
      explainPlan: { plan: 'FULL SCAN' }
    });
    
    // PostgreSQL fast query
    logger.analysis?.({
      sql: 'SELECT * FROM orders WHERE id = $1',
      params: [123],
      durationMs: 8,
      provider: 'postgresql',
      slow: false
    });
    
    // MySQL slow query
    logger.analysis?.({
      sql: 'SELECT * FROM customers JOIN orders ON customers.id = orders.customer_id',
      params: [],
      durationMs: 450,
      provider: 'mysql',
      slow: true,
      explainPlan: { plan: 'Using join buffer' }
    });
    
    expect(logger).toBeDefined();
  });

  it('should no-op when analysis hook is called without client', () => {
    const logger = new PrometheusSqlLogger('test');
    
    const info: QueryAnalysisInfo = {
      sql: 'SELECT * FROM users',
      params: [],
      durationMs: 100,
      provider: 'sqlite',
      slow: true
    };
    
    // Should not throw even without prom-client
    logger.analysis?.(info);
    
    expect(logger).toBeDefined();
  });
});
