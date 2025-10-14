import 'reflect-metadata';
import { ProviderStub } from './_stubs/ProviderStub';
import { CircuitOpenError } from '../../src/types';

class FlakyProviderConcurrent extends ProviderStub {
  private remainingFails: number;
  constructor(fails: number, openMs: number = 30) {
    super(':memory:');
    this.remainingFails = fails;
    (this as unknown as { circuitOptions: unknown }).circuitOptions = {
      failureThreshold: 1,
      openDurationMs: openMs,
      halfOpenMaxCalls: 2
    };
  }
  protected async doExecuteNonQuery(sql: string): Promise<number> {
    if (this.remainingFails > 0) {
      this.remainingFails--;
      const err = new Error('timeout');
      throw err;
    }
    await new Promise((r) => setTimeout(r, 10));
    return 0;
  }
}

describe('Circuit Breaker half-open concurrency', () => {
  test('limits half-open concurrent probes', async () => {
    const p = new FlakyProviderConcurrent(1, 20);
    // Open circuit after one failure
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(CircuitOpenError);
    // Wait to move to half-open
    await new Promise((r) => setTimeout(r, 25));
    // Start 2 allowed probes concurrently + 1 extra which should be short-circuited
    const a = p.executeNonQuery('UPDATE t SET a=1');
    const b = p.executeNonQuery('UPDATE t SET a=1');
    const c = p.executeNonQuery('UPDATE t SET a=1');
    const results = await Promise.allSettled([a, b, c]);
    const rejectedOpen = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof CircuitOpenError
    );
    expect(rejectedOpen.length).toBe(1);
  });
});
