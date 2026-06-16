import { beforeEach, describe, expect, it } from '@jest/globals';

import { PrometheusSqlLogger } from '../src/logger/PrometheusSqlLogger';

type LabelValues = Record<string, string>;

// Captures every label object handed to any metric so we can assert that no
// redacted literal leaks through the masked SQL path into a time-series label.
const capturedLabels: LabelValues[] = [];

class CapturingCounter {
  labels(lbl: LabelValues) {
    capturedLabels.push(lbl);
    return { inc: (_v?: number) => {} };
  }
}
class CapturingHistogram {
  labels(lbl: LabelValues) {
    capturedLabels.push(lbl);
    return { observe: (_v: number) => {} };
  }
}
class CapturingGauge {
  inc(lbl?: LabelValues) {
    if (lbl) capturedLabels.push(lbl);
  }
  dec(lbl?: LabelValues) {
    if (lbl) capturedLabels.push(lbl);
  }
}

const fakeClient = {
  Counter: CapturingCounter,
  Histogram: CapturingHistogram,
  Gauge: CapturingGauge
} as unknown as never;

describe('PrometheusSqlLogger — SQL masking', () => {
  beforeEach(() => {
    capturedLabels.length = 0;
  });

  it('never leaks a redacted literal into any emitted metric label', () => {
    const logger = new PrometheusSqlLogger('test', {
      client: fakeClient,
      prefix: 'tsl_',
      maskSql: true
    });
    const secret = 'super-secret-pw';

    logger.queryStart?.({
      sql: `SELECT * FROM users WHERE pw = '${secret}'`,
      params: [],
      provider: 'postgresql'
    });
    logger.queryEnd?.({
      sql: `SELECT * FROM users WHERE pw = '${secret}'`,
      params: [],
      durationMs: 3,
      provider: 'postgresql'
    });

    const serialized = JSON.stringify(capturedLabels);
    expect(serialized).not.toContain(secret);
    // bounded labels are still derived (table name survives masking; entity is upper-cased)
    expect(serialized.toUpperCase()).toContain('USERS');
  });

  it('does not throw when masking is enabled with a custom pattern', () => {
    const logger = new PrometheusSqlLogger('test', {
      client: fakeClient,
      prefix: 'tsl_',
      maskSql: true,
      maskPatterns: [/[0-9]+/g]
    });

    expect(() =>
      logger.queryEnd?.({
        sql: "SELECT * FROM orders WHERE total = '999'",
        params: [],
        durationMs: 1,
        provider: 'mysql'
      })
    ).not.toThrow();
  });
});
