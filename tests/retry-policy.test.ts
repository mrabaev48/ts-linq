import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';

class FlakyProvider extends SQLiteProvider {
  private failCount = 0;
  constructor(failTimes: number) {
    super(':memory:');
    this.failCount = failTimes;
  }
  public async connect() {/* no-op */}
  public async disconnect() {/* no-op */}
  protected async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.failCount > 0 && !this.inTransactionState) {
      this.failCount--;
      const err: any = new Error('transient timeout'); err.message = 'Timeout occurred';
      throw err;
    }
    return [] as any;
  }
  protected async doExecuteNonQuery(sql: string, params: any[] = []): Promise<number> {
    if (this.failCount > 0 && !this.inTransactionState) {
      this.failCount--;
      const err: any = new Error('connection lost'); err.message = 'Connection lost';
      throw err;
    }
    return 1;
  }
}

describe('Provider retry policy', () => {
  it('retries up to maxAttempts for transient errors when not in transaction', async () => {
    const p = new FlakyProvider(2);
    await p.connect();
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(50); // at least one backoff
    await p.disconnect();
  });

  it('does not retry inside explicit transaction', async () => {
    const p = new FlakyProvider(1);
    await p.connect();
    await p.beginTransaction();
    // В транзакции doExecuteNonQuery отдаст 1 без ретраев — поэтому симулируем ошибку через spy
    const spy = jest.spyOn<any, any>(p as any, 'doExecuteNonQuery').mockImplementation(() => {
      const err: any = new Error('deadlock'); err.message = 'deadlock'; throw err;
    });
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    spy.mockRestore();
    await p.rollbackTransaction();
    await p.disconnect();
  });
});


