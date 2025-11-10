import 'reflect-metadata';
import { DbContext } from '../../src/context/DbContext';
import { DatabaseProvider } from '../../src/DatabaseProvider';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { CountCache, CountCacheEntry } from '../../src/query/CountCache';

class LoggerMock {
  public cacheCalls: Array<{
    cache: 'sqlGen' | 'count' | 'entityL2';
    hit: boolean;
    provider?: string;
  }> = [];
  public cacheSizeCalls: Array<{
    cache: 'sqlGen' | 'count' | 'entityL2';
    size: number;
    provider?: string;
  }> = [];
  cache(p: { cache: 'sqlGen' | 'count' | 'entityL2'; hit: boolean; provider?: string }): void {
    this.cacheCalls.push(p);
  }
  cacheSize(p: { cache: 'sqlGen' | 'count' | 'entityL2'; size: number; provider?: string }): void {
    this.cacheSizeCalls.push(p);
  }
}

class ProviderStub extends DatabaseProvider {
  private logger: LoggerMock;
  constructor(label: string, logger: LoggerMock) {
    super(label);
    this.logger = logger;
  }
  get loggerRef(): LoggerMock {
    return this.logger;
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    if (sql.toUpperCase().includes('COUNT')) return [{ count: 1 } as unknown as T];
    return [{ id: 1 } as unknown as T];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  public getDialect(): any {
    return {
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] })
    };
  }
}

class InMemoryCount implements CountCache {
  private m = new Map<string, CountCacheEntry>();
  get(key: string): CountCacheEntry | undefined {
    return this.m.get(key);
  }
  set(key: string, entry: CountCacheEntry): void {
    this.m.set(key, { value: entry.value, ts: entry.ts });
  }
  clear(): void {
    this.m.clear();
  }
  invalidateBy(): number {
    return 0;
  }
}

class Product {
  id!: number;
}

describe('Cache logging (hits/misses)', () => {
  beforeAll(() => {
    MetadataStorage.addEntity(Product, 'products');
    MetadataStorage.addPrimaryKey(Product, 'id');
  });

  test('count() logs miss then hit', async () => {
    const logger = new LoggerMock();
    const provider = new ProviderStub('test', logger);
    const ctx = new (class extends DbContext {
      constructor() {
        super({
          provider,
          performance: {
            enableCountCache: true,
            countCacheTtlMs: 10000,
            countCache: new InMemoryCount()
          }
        } as any);
      }
    })();
    const q = (ctx as unknown as { products: any }).products as { count: () => Promise<number> };
    await q.count();
    await q.count();
    const kinds = logger.cacheCalls.filter((c) => c.cache === 'count').map((c) => c.hit);
    expect(kinds).toContain(false); // miss
    expect(kinds).toContain(true); // hit
  });

  test('entity L2 logs miss and hit', async () => {
    const logger = new LoggerMock();
    const provider = new ProviderStub('test', logger);
    const ctx = new (class extends DbContext {
      constructor() {
        super({ provider, performance: { enableEntityCache: true } } as any);
      }
    })();
    const q = (ctx as unknown as { products: any }).products as {
      toArray: () => Promise<Array<{ id: number }>>;
    };
    await q.toArray(); // first materialization -> miss path then remember -> subsequent toArray may be hit depending on SQL
    await q.toArray();
    const l2 = logger.cacheCalls.filter((c) => c.cache === 'entityL2').map((c) => c.hit);
    expect(l2).toContain(false);
    expect(l2).toContain(true);
  });
});
