import { TestProvider } from '@ts-linq/testkits';
import type { RetryPolicy } from '@ts-linq/types';
import { DatabaseError } from '@ts-linq/types';

class FlakyProvider extends TestProvider {
  public attempts = 0;
  public succeedAfter = 0;
  public failMessage = 'Connection timeout'; // Transient

  public async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    this.attempts++;
    if (this.attempts <= this.succeedAfter) {
      throw new DatabaseError(this.failMessage);
    }
    return super.doExecuteQuery(sql, params);
  }
}

class CustomRetryPolicy implements RetryPolicy {
  shouldRetry(error: Error, attempt: number): boolean {
    return attempt < 3;
  }
  getDelayMs(attempt: number): number {
    return 10; // Fast retry
  }
}

describe('Telemetry Integration - Retry Policies', () => {
  it('should retry transient failures and succeed', async () => {
    const provider = new FlakyProvider(':memory:');
    await provider.connect();

    provider.succeedAfter = 2; // Fail twice -> Retry 1, Retry 2
    provider.attempts = 0;

    await provider.executeQuery('SELECT 1');

    expect(provider.attempts).toBe(3); // Initial + 2 retries
    await provider.disconnect();
  });

  it('should give up after max retries', async () => {
    const provider = new FlakyProvider(':memory:');
    await provider.connect();

    provider.succeedAfter = 10;
    provider.attempts = 0;

    await expect(provider.executeQuery('SELECT 1')).rejects.toThrow();

    // Initial(1) + Retry(1) + Retry(2) = 3 attempts total.
    // Policy allows attempt < 3.
    // attempt 1 -> shouldRetry(err, 1) -> true -> retry
    // attempt 2 -> shouldRetry(err, 2) -> true -> retry
    // attempt 3 -> shouldRetry(err, 3) -> false -> throw
    expect(provider.attempts).toBe(3);

    await provider.disconnect();
  });

  it('should not retry if policy returns false (e.g. non-transient)', async () => {
    const provider = new FlakyProvider(':memory:');
    await provider.connect();

    provider.failMessage = 'Syntax error'; // Non-transient
    provider.succeedAfter = 2;
    provider.attempts = 0;

    await expect(provider.executeQuery('SELECT 1')).rejects.toThrow('Syntax error');
    expect(provider.attempts).toBe(1); // No retries

    await provider.disconnect();
  });
});
