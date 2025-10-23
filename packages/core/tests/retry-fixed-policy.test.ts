import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { ProviderStub } from './_stubs/ProviderStub';
import type { DbSet } from '../src/context/DbSet';
import { FixedIntervalRetryPolicy } from '../src/utils/RetryPolicies';
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';

class FxUser {}
MetadataStorage.addEntity(FxUser, 'fx_user');
const idCol: ColumnMetadata = {
  propertyName: 'id',
  columnName: 'id',
  type: 'INTEGER',
  nullable: false,
  isGenerated: true,
  isVersion: false
};
MetadataStorage.addColumn(FxUser, idCol);
MetadataStorage.addPrimaryKey(FxUser, 'id');

class Ctx extends DbContext {
  public users!: DbSet<FxUser>;
  constructor() {
    super({
      provider: new ProviderStub(':memory:') as unknown as 'sqlite',
      connectionString: ':memory:',
      retryPolicy: new FixedIntervalRetryPolicy(25)
    });
  }
}

interface ProviderInternal {
  doExecuteNonQuery: (...args: unknown[]) => unknown;
  executeNonQuery(sql: string, params?: readonly unknown[]): Promise<number>;
}

describe('FixedIntervalRetryPolicy', () => {
  test('retries using fixed delay', async () => {
    const ctx = new Ctx();
    await ctx.ensureCreated();
    const p = (ctx as unknown as { provider: unknown }).provider as ProviderInternal;
    let fails = 1;
    const spy = jest
      .spyOn(p, 'doExecuteNonQuery' as keyof ProviderInternal)
      .mockImplementation(() => {
        if (fails-- > 0) {
          throw new Error('timeout');
        }
        return 1;
      });
    const t0 = Date.now();
    await expect(p.executeNonQuery('UPDATE t SET a=1')).resolves.toBe(1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(20);
    spy.mockRestore();
  });
});
