import { DbContext } from '../src/context/DbContext';
import { FixedIntervalRetryPolicy } from '../src/utils/RetryPolicies';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { ColumnMetadata } from '../src/types';

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
  public users!: any;
  constructor() {
    super({
      provider: 'sqlite',
      connectionString: ':memory:',
      retryPolicy: new FixedIntervalRetryPolicy(25)
    });
  }
}

describe('FixedIntervalRetryPolicy', () => {
  test('retries using fixed delay', async () => {
    const ctx = new Ctx();
    await ctx.ensureCreated();
    const p: any = (ctx as any).provider;
    let fails = 1;
    const spy = jest.spyOn(p as any, 'doExecuteNonQuery').mockImplementation(() => {
      if (fails-- > 0) {
        const err: any = new Error('timeout');
        err.message = 'timeout';
        throw err;
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
