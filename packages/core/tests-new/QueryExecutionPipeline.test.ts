import { describe, expect, it } from '@jest/globals';
import type { RetryPolicy, SqlLogger } from '@ts-linq/types';

import type { QueryExecutionRequest } from '../src/execution/QueryExecutionPipeline';
import { QueryExecutionPipeline } from '../src/execution/QueryExecutionPipeline';
import { ResilienceManager } from '../src/Resilience/ResilienceManager';

interface RequestProbe {
  readonly request: QueryExecutionRequest;
  readonly events: string[];
  readonly analyzeCalls: Array<{ durationMs: number; error?: Error }>;
}

function makeRequest(
  overrides: Partial<QueryExecutionRequest> = {},
  logger?: SqlLogger
): RequestProbe {
  const events: string[] = [];
  const analyzeCalls: Array<{ durationMs: number; error?: Error }> = [];
  const request: QueryExecutionRequest = {
    sql: 'SELECT 1',
    params: [],
    traceId: 'trace-1',
    inTransaction: false,
    providerName: 'test-db',
    logger,
    onStart: () => events.push('onStart'),
    beforeExecute: async () => {
      events.push('beforeExecute');
    },
    afterExecute: async () => {
      events.push('afterExecute');
    },
    analyze: async (durationMs, error) => {
      events.push(error ? 'analyze:error' : 'analyze:ok');
      analyzeCalls.push({ durationMs, error });
    },
    ...overrides
  };
  return { request, events, analyzeCalls };
}

/** ResilienceManager with circuit disabled and no retries (single attempt). */
function plainResilience(logger?: SqlLogger): ResilienceManager {
  return new ResilienceManager(logger, 'test-db', { enabled: false });
}

describe('QueryExecutionPipeline', () => {
  it('runs the orchestration sequence in order on success', async () => {
    const captured: Array<{ event: string; payload: unknown }> = [];
    const logger: SqlLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      queryStart: (i) => captured.push({ event: 'queryStart', payload: i }),
      queryEnd: (i) => captured.push({ event: 'queryEnd', payload: i })
    };
    const pipeline = new QueryExecutionPipeline(plainResilience(logger));
    const probe = makeRequest({}, logger);

    const result = await pipeline.execute(async () => [{ a: 1 }, { a: 2 }], probe.request);

    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
    expect(probe.events).toEqual(['onStart', 'beforeExecute', 'analyze:ok', 'afterExecute']);
    expect(captured.map((c) => c.event)).toEqual(['queryStart', 'queryEnd']);
    // queryEnd carries the mapped row count for array results
    expect((captured[1].payload as { rows?: number }).rows).toBe(2);
  });

  it('maps a numeric result to the affected-rows count', async () => {
    const captured: Array<{ rows?: number }> = [];
    const logger: SqlLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      queryEnd: (i) => captured.push({ rows: i.rows })
    };
    const pipeline = new QueryExecutionPipeline(plainResilience(logger));
    const probe = makeRequest({}, logger);

    await pipeline.execute(async () => 7, probe.request);

    expect(captured[0].rows).toBe(7);
  });

  it('logs + analyses the failure and skips afterExecute on error', async () => {
    const pipeline = new QueryExecutionPipeline(plainResilience());
    const probe = makeRequest();
    const boom = new Error('exec failed');

    await expect(
      pipeline.execute(async () => {
        throw boom;
      }, probe.request)
    ).rejects.toBe(boom);

    expect(probe.events).toEqual(['onStart', 'beforeExecute', 'analyze:error']);
    expect(probe.events).not.toContain('afterExecute');
    expect(probe.analyzeCalls[0].error).toBe(boom);
  });

  it('re-runs the full sequence on a retried transient failure (retry parity)', async () => {
    const retryPolicy: RetryPolicy = {
      shouldRetry: (_e, attempt) => attempt < 2,
      getDelayMs: () => 0
    };
    const resilience = new ResilienceManager(
      undefined,
      'test-db',
      { enabled: true },
      retryPolicy,
      () => true
    );
    const pipeline = new QueryExecutionPipeline(resilience);
    const probe = makeRequest();

    let attempts = 0;
    const result = await pipeline.execute(async () => {
      attempts++;
      if (attempts === 1) throw new Error('transient');
      return 'ok';
    }, probe.request);

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
    // onStart/beforeExecute ran on each attempt; afterExecute only on success
    expect(probe.events.filter((e) => e === 'onStart')).toHaveLength(2);
    expect(probe.events.filter((e) => e === 'beforeExecute')).toHaveLength(2);
    expect(probe.events.filter((e) => e === 'afterExecute')).toHaveLength(1);
  });
});
