import 'reflect-metadata';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/DatabaseProvider';
import { DbContext } from '../src/context/DbContext';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';
import { ValidationError } from '../src/types';

jest.mock('../src/query/Queryable', () => ({
  Queryable: { clearCountCache: jest.fn() }
}));

jest.mock('metrics-safe', () => ({
  safeCacheSize: jest.fn()
}));

class TestContext extends DbContext {}

function providerStub(): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: 'sqlite',
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    createTable: jest.fn(async () => {}),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    inTransactionState: false,
    getDialect: jest.fn(),
    executeQuery: jest.fn(),
    executeNonQuery: jest.fn(),
    insert: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
    upsert: jest.fn(async () => {}),
    loggerRef: {}
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('DbContext extra coverage', () => {
  class E {
    id!: number;
    name?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }

  beforeEach(() => {
    (MetadataStorage as unknown as { getInstance: () => MetadataStorage }).getInstance().clear();
    MetadataStorage.addEntity(E, 'E');
    MetadataStorage.addColumn(E, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      isGenerated: true
    } as any);
    MetadataStorage.addPrimaryKey(E, 'id');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('ensureCreated connects and creates tables', async () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    // add one more column to ensure snapshot is valid
    MetadataStorage.addColumn(E, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: true
    } as any);
    await ctx.ensureCreated();
    expect(provider.connect).toHaveBeenCalled();
    expect(provider.createTable).toHaveBeenCalledTimes(1);
  });

  test('include: non-proxy uses EntityLoader.populateRelationships', async () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const spy = jest
      .spyOn(require('../src/loading/EntityLoader').EntityLoader.prototype, 'populateRelationships')
      .mockResolvedValue(undefined);
    const e = new E();
    await ctx.include(e, E, 'rel');
    expect(spy).toHaveBeenCalled();
  });

  test('include: lazy proxy uses LazyLoadingProxy.preloadRelationships', async () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const lp = require('../src/loading/LazyLoadingProxy').LazyLoadingProxy as {
      isLazyProxy: (o: unknown) => boolean;
      preloadRelationships: (...args: unknown[]) => Promise<void>;
    };
    const spyIs = jest.spyOn(lp, 'isLazyProxy').mockReturnValue(true);
    const spyPre = jest.spyOn(lp, 'preloadRelationships').mockResolvedValue(undefined as any);
    const e = {} as E;
    await ctx.include(e, E, 'rel');
    expect(spyIs).toHaveBeenCalled();
    expect(spyPre).toHaveBeenCalled();
  });

  test('isLoaded: non-proxy checks property presence', () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const e = { a: 1 };
    expect(ctx.isLoaded(e as any, 'a')).toBe(true);
    expect(ctx.isLoaded(e as any, 'b')).toBe(false);
  });

  test('isLoaded: proxy delegates to LazyLoadingProxy', () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const lp = require('../src/loading/LazyLoadingProxy').LazyLoadingProxy as {
      isLazyProxy: (o: unknown) => boolean;
      isRelationshipLoaded: (o: unknown, p: string) => boolean;
    };
    jest.spyOn(lp, 'isLazyProxy').mockReturnValue(true);
    const spy = jest.spyOn(lp, 'isRelationshipLoaded').mockReturnValue(true);
    expect(ctx.isLoaded({} as any, 'x')).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  test('saveChanges: early return with no changes', async () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const res = await ctx.saveChanges();
    expect(res).toBe(0);
  });

  test('trySaveChanges: returns err on validation failure', async () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    MetadataStorage.addColumn(E, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    } as any);
    const set = ctx.set(E);
    set.add({} as any);
    const result = await ctx.trySaveChanges();
    expect(result.ok).toBe(false);
    expect((result as any).error).toBeInstanceOf(ValidationError);
  });

  test('applyAudit fills createdAt/updatedAt before provider.insert', async () => {
    const provider = providerStub();
    const ctx = new TestContext({
      provider,
      audit: {
        enabled: true,
        timeColumns: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        userColumns: {}
      } as any
    });
    MetadataStorage.addColumn(E, {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'DATETIME',
      nullable: false
    } as any);
    MetadataStorage.addColumn(E, {
      propertyName: 'updatedAt',
      columnName: 'updated_at',
      type: 'DATETIME',
      nullable: false
    } as any);
    const set = ctx.set(E);
    const entity = { name: 'x' } as any;
    set.add(entity);
    await ctx.saveChanges();
    expect(provider.insert).toHaveBeenCalled();
    const passed = (provider.insert as jest.Mock).mock.calls[0][0];
    expect(passed.createdAt).toBeInstanceOf(Date);
    expect(passed.updatedAt).toBeInstanceOf(Date);
  });

  test('setLoadingStrategy delegates to EntityLoader.setDefaultStrategy', () => {
    const provider = providerStub();
    const ctx = new TestContext({ provider });
    const spy = jest.spyOn(
      require('../src/loading/EntityLoader').EntityLoader.prototype,
      'setDefaultStrategy'
    );
    ctx.setLoadingStrategy(LoadingStrategy.Lazy);
    expect(spy).toHaveBeenCalledWith(LoadingStrategy.Lazy);
  });

  test('commitTransaction and rollbackTransaction clear caches and call provider', async () => {
    const provider = providerStub();
    const ctx = new TestContext({
      provider,
      performance: { enableEntityCache: true, entityCacheSize: 10 } as any
    });
    const { Queryable } = require('../src/query/Queryable');
    const { safeCacheSize } = require('metrics-safe');

    await ctx.beginTransaction();
    expect(provider.beginTransaction).toHaveBeenCalled();

    await ctx.commitTransaction();
    expect(provider.commitTransaction).toHaveBeenCalled();
    expect(Queryable.clearCountCache).toHaveBeenCalled();
    expect(safeCacheSize).toHaveBeenCalled();

    await ctx.rollbackTransaction();
    expect(provider.rollbackTransaction).toHaveBeenCalled();
    expect(Queryable.clearCountCache).toHaveBeenCalled();
    expect(safeCacheSize).toHaveBeenCalled();
  });
});
