import { ProviderStub } from './_stubs/ProviderStub';
import type { SqlParameter } from '@ts-linq/types';
import { CircuitOpenError } from '@ts-linq/types';

class FlakyProvider extends ProviderStub {
  private remainingFails: number;
  constructor(fails: number, openMs: number = 50) {
    super(':memory:');
    this.remainingFails = fails;
    // tune circuit options for fast tests
    (this as unknown as { circuitOptions: unknown }).circuitOptions = {
      failureThreshold: 2,
      openDurationMs: 1000,
      maxOpenDurationMs: 1000,
      halfOpenMaxCalls: 1,
      countTransientOnly: true
    } as {
      failureThreshold?: number;
      openDurationMs?: number;
      maxOpenDurationMs?: number;
      halfOpenMaxCalls?: number;
      countTransientOnly?: boolean;
    };
  }
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    if (this.remainingFails > 0) {
      this.remainingFails--;
      const err: Error & { message: string } = new Error('timeout');
      err.message = 'timeout';
      throw err;
    }
    return await super.doExecuteNonQuery(sql, params);
  }
}

describe('Circuit Breaker', () => {
  test('opens after failure threshold and short-circuits', async () => {
    const p = new FlakyProvider(2, 100);
    // 1st and 2nd attempts fail and count towards threshold
    await expect(p.executeNonQuery('DELETE FROM t')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('DELETE FROM t')).rejects.toBeTruthy();
    // immediately after threshold, circuit must be open and short-circuit
    await expect(p.executeNonQuery('DELETE FROM t')).rejects.toBeInstanceOf(CircuitOpenError);
  });

  test('moves to half-open after cooldown and closes on successful probe', async () => {
    const p = new FlakyProvider(2, 50);
    // open the circuit
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(CircuitOpenError);
    // wait for cooldown to allow half-open probe
    await new Promise((r) => setTimeout(r, 1100));
    // remainingFails is 0 now → probe succeeds → circuit closes
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(0);
    // next calls should be allowed (closed)
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(0);
  });

  test('half-open probe failure immediately re-opens', async () => {
    const p = new FlakyProvider(3, 30);
    // drive to open (2 failures)
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(CircuitOpenError);
    // wait for cooldown → half-open; we still have one remaining failure
    await new Promise((r) => setTimeout(r, 80));
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    // After failed probe, circuit is open again; next call should short-circuit
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeInstanceOf(CircuitOpenError);
  });
});
