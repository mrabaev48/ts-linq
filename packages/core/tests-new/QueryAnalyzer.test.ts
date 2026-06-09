import { describe, expect, it } from '@jest/globals';
import type { QueryAnalysisInfo, SqlLogger } from '@ts-linq/types';

import type { QueryAnalysisContext } from '../src/analysis/QueryAnalyzer';
import { QueryAnalyzer } from '../src/analysis/QueryAnalyzer';

function capturingLogger(sink: QueryAnalysisInfo[]): SqlLogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    analysis: (info) => sink.push(info)
  };
}

function ctx(overrides: Partial<QueryAnalysisContext> = {}): QueryAnalysisContext {
  return {
    inTransaction: false,
    providerName: 'test-db',
    logger: undefined,
    middlewares: undefined,
    getExplainPlan: async () => undefined,
    ...overrides
  };
}

describe('QueryAnalyzer', () => {
  it('emits nothing when analysis is disabled', async () => {
    const events: QueryAnalysisInfo[] = [];
    const a = new QueryAnalyzer();
    a.configure({ enabled: false });
    await a.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 5000 },
      ctx({ logger: capturingLogger(events) })
    );
    expect(events).toHaveLength(0);
  });

  it('skips non-SELECT statements when onlySelect (default)', async () => {
    const events: QueryAnalysisInfo[] = [];
    const a = new QueryAnalyzer();
    a.configure({ enabled: true });
    await a.analyze(
      { sql: 'UPDATE t SET a=1', params: [], durationMs: 5000 },
      ctx({ logger: capturingLogger(events) })
    );
    expect(events).toHaveLength(0);
  });

  it('applies probabilistic sampling deterministically via injected random', async () => {
    const events: QueryAnalysisInfo[] = [];
    // random() = 0.9 > 0.5 → skip
    const skipper = new QueryAnalyzer(
      () => 0,
      () => 0.9
    );
    skipper.configure({ enabled: true, sampleRate: 0.5 });
    await skipper.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 10 },
      ctx({ logger: capturingLogger(events) })
    );
    expect(events).toHaveLength(0);

    // random() = 0.1 <= 0.5 → emit
    const emitter = new QueryAnalyzer(
      () => 0,
      () => 0.1
    );
    emitter.configure({ enabled: true, sampleRate: 0.5 });
    await emitter.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 10 },
      ctx({ logger: capturingLogger(events) })
    );
    expect(events).toHaveLength(1);
  });

  it('caps analysis events at the per-minute limit within a window', async () => {
    // Parity note: the extracted windowing matches the original provider exactly.
    // `windowStartMs` is only seeded inside the reset branch, so a window does not
    // roll over here — once the cap is reached no further events are emitted. The
    // missing first-window seed is a pre-existing quirk tracked as follow-up tech
    // debt; this refactor preserves behaviour rather than changing it.
    const events: QueryAnalysisInfo[] = [];
    let clock = 1_000_000;
    const a = new QueryAnalyzer(
      () => clock,
      () => 0
    );
    a.configure({ enabled: true, rateLimitPerMinute: 2 });
    const c = ctx({ logger: capturingLogger(events) });

    await a.analyze({ sql: 'SELECT 1', params: [], durationMs: 1 }, c);
    await a.analyze({ sql: 'SELECT 2', params: [], durationMs: 1 }, c);
    await a.analyze({ sql: 'SELECT 3', params: [], durationMs: 1 }, c); // over the limit
    expect(events).toHaveLength(2);

    // Even after advancing the clock the cap holds (window never re-seeds) — parity.
    clock += 60_001;
    await a.analyze({ sql: 'SELECT 4', params: [], durationMs: 1 }, c);
    expect(events).toHaveLength(2);
  });

  it('captures an EXPLAIN plan when over the threshold', async () => {
    const events: QueryAnalysisInfo[] = [];
    const a = new QueryAnalyzer(
      () => 0,
      () => 0
    );
    a.configure({ enabled: true, explainThresholdMs: 100 });
    await a.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 200 },
      ctx({ logger: capturingLogger(events), getExplainPlan: async () => ({ plan: 'seq-scan' }) })
    );
    expect(events).toHaveLength(1);
    expect(events[0].explainPlan).toEqual({ plan: 'seq-scan' });
  });

  it('falls back to no plan when EXPLAIN exceeds its timeout (race lost)', async () => {
    const events: QueryAnalysisInfo[] = [];
    // injected sleep resolves immediately -> timeout wins the race -> plan undefined
    const a = new QueryAnalyzer(
      () => 0,
      () => 0,
      async () => undefined
    );
    a.configure({ enabled: true, explainThresholdMs: 100, explainTimeoutMs: 1 });
    await a.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 200 },
      ctx({
        logger: capturingLogger(events),
        // never resolves: the injected sleep (timeout) must win
        getExplainPlan: () => new Promise(() => {})
      })
    );
    expect(events).toHaveLength(1);
    expect(events[0].explainPlan).toBeUndefined();
  });

  it('skips EXPLAIN inside a transaction', async () => {
    let explainCalls = 0;
    const events: QueryAnalysisInfo[] = [];
    const a = new QueryAnalyzer(
      () => 0,
      () => 0
    );
    a.configure({ enabled: true, explainThresholdMs: 100 });
    await a.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 200 },
      ctx({
        inTransaction: true,
        logger: capturingLogger(events),
        getExplainPlan: async () => {
          explainCalls++;
          return {};
        }
      })
    );
    expect(explainCalls).toBe(0);
    expect(events[0].explainPlan).toBeUndefined();
  });

  it('marks the slow flag and labels the provider', async () => {
    const events: QueryAnalysisInfo[] = [];
    const a = new QueryAnalyzer(
      () => 0,
      () => 0
    );
    a.configure({ enabled: true, slowQueryThresholdMs: 1000 });
    await a.analyze(
      { sql: 'SELECT 1', params: [], durationMs: 1500 },
      ctx({ logger: capturingLogger(events) })
    );
    expect(events[0].slow).toBe(true);
    expect(events[0].provider).toBe('test-db');
  });
});
