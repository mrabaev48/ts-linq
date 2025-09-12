import { DbContext } from '../src/context/DbContext';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { ColumnMetadata, RetryPolicy } from '../src/types';

interface ProviderInternal {
  doExecuteNonQuery: (...args: unknown[]) => unknown;
  executeNonQuery(sql: string, params?: readonly unknown[]): Promise<number>;
}
import { ExponentialBackoffRetryPolicy, NoRetryPolicy } from '../src/utils/RetryPolicies';

class RsUser {}
MetadataStorage.addEntity(RsUser, 'rs_user');
const idCol: ColumnMetadata = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage.addColumn(RsUser, idCol);
MetadataStorage.addPrimaryKey(RsUser, 'id');

class Ctx extends DbContext {
  public rs_users!: unknown;
  constructor(policy?: RetryPolicy) {
    super({ provider: 'sqlite', connectionString: ':memory:', retryPolicy: policy });
  }
}

describe('RetryPolicy strategies', () => {
  test('NoRetryPolicy disables retries', async () => {
    const ctx = new Ctx(new NoRetryPolicy());
    await ctx.ensureCreated();
    // Spy on provider.executeWithRetry through executeNonQuery by forcing an error and checking timing
    const p = (ctx as unknown as { provider: unknown }).provider as ProviderInternal;
    const spy = jest.spyOn(p, 'doExecuteNonQuery' as any).mockImplementation(() => {
      const err: Error & { message: string } = new Error('timeout');
      err.message = 'timeout';
      throw err;
    });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).rejects.toBeTruthy();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50);
    spy.mockRestore();
  });

  test('ExponentialBackoffRetryPolicy retries with backoff', async () => {
    const ctx = new Ctx(new ExponentialBackoffRetryPolicy({ baseDelayMs: 10 }));
    await ctx.ensureCreated();
    const p = (ctx as unknown as { provider: unknown }).provider as ProviderInternal;
    let fails = 2;
    const spy = jest.spyOn(p, 'doExecuteNonQuery' as any).mockImplementation(() => {
      if (fails-- > 0) {
        const err: Error & { message: string } = new Error('timeout');
        err.message = 'timeout';
        throw err;
      }
      return 1;
    });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(10);
    spy.mockRestore();
  });
});
