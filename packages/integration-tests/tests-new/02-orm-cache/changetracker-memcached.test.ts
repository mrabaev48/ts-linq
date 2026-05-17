import { MemcachedEntityCacheAdapter, MemcachedSqlClientLike } from '@ts-linq/cache-memcached';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { TestProvider as MockProvider } from '@ts-linq/testkits';

@Entity({ name: 'memcached_users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  public id!: number;

  @Column({ type: 'TEXT' })
  public name!: string;

  @Column({ type: 'INTEGER' })
  public age!: number;
}

class TestDbContext extends DbContext {
  constructor(
    provider: MockProvider,
    cacheAdapter: MemcachedEntityCacheAdapter,
    writeThrough: boolean = true
  ) {
    super({
      provider,
      performance: {
        enableEntityCache: true,
        entityCache: cacheAdapter
      }
    });
  }
}

describe('ChangeTracker + Memcached Integration', () => {
  let provider: MockProvider;
  let context: TestDbContext;
  let client: jest.Mocked<MemcachedSqlClientLike>;
  let adapter: MemcachedEntityCacheAdapter;
  let store: Map<string, { value: Buffer; expires?: number }>;

  beforeEach(async () => {
    store = new Map();
    provider = new MockProvider();

    // Mock memjs client
    client = {
      get: jest.fn(async (key: string) => {
        const val = store.get(key);
        return val ? { value: val.value } : null;
      }),
      set: jest.fn(async (key: string, value: Buffer | string, options?: { expires?: number }) => {
        const bufferVal = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
        store.set(key, { value: bufferVal, expires: options?.expires });
        return true;
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
        return true;
      })
    };

    adapter = new MemcachedEntityCacheAdapter(client, {
      ttlSeconds: 3600,
      keyPrefix: 'test:',
      writeThrough: true
    });

    context = new TestDbContext(provider, adapter);
    await context.ensureCreated();
  });

  afterEach(async () => {
    // Cleanup
  });

  it('should cache entities in Memcached on insert', async () => {
    const user = new User();
    user.name = 'Alice';
    user.age = 30;

    // Simulate ID generation
    provider.insert = async (entity: any) => {
      entity.id = 1;
      return entity;
    };

    context.set(User).add(user);
    await context.saveChanges();

    // Give async write-through a tick
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.set).toHaveBeenCalled();
    const key = 'test:User|1';
    expect(store.has(key)).toBe(true);

    const stored = store.get(key);
    const parsed = JSON.parse(stored!.value.toString());
    expect(parsed).toMatchObject({ id: 1, name: 'Alice', age: 30 });
  });

  it('should retrieve entities from Memcached (via shadow population)', async () => {
    const key = 'test:User|1';
    const data = JSON.stringify({ id: 1, name: 'Bob', age: 40 });
    store.set(key, { value: Buffer.from(data) });

    // 1. First get matches nothing in shadow, triggers async fetch
    const r1 = adapter.get(User, 1);
    expect(r1).toBeUndefined(); // Because adapter is async read-through but find is sync L2 check

    // Give async fetch a tick
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(client.get).toHaveBeenCalledWith(key);

    // 2. Second get should hit shadow
    const r2 = adapter.get(User, 1);
    expect(r2).toBeDefined();
    expect(r2?.name).toBe('Bob');
  });

  it('should remove from Memcached on delete', async () => {
    // Pre-populate
    const user = new User();
    user.id = 1;
    user.name = 'Charlie';
    user.age = 50;

    // Manually seed adapter shadow to simulate it being loaded
    adapter.set(User, 1, user);

    // Seed backend too
    const key = 'test:User|1';
    store.set(key, { value: Buffer.from(JSON.stringify(user)) });

    context.set(User).remove(user);
    await context.saveChanges();

    // Give async delete a tick
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.delete).toHaveBeenCalledWith(key);
    expect(store.has(key)).toBe(false);
  });

  it('should support custom serialization', async () => {
    const customAdapter = new MemcachedEntityCacheAdapter(client, {
      serializer: (e: any) => `CUSTOM:${e.id}:${e.name}`,
      deserializer: (s: string) => {
        const parts = s.split(':');
        return { id: Number(parts[1]), name: parts[2], age: 99 };
      },
      writeThrough: true
    });

    const customContext = new TestDbContext(provider, customAdapter);

    const user = new User();
    user.name = 'Dave';
    user.age = 20;
    provider.insert = async (entity: any) => {
      entity.id = 9;
      return entity;
    };

    customContext.set(User).add(user);
    await customContext.saveChanges();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const key = 'tslnq:entity:User|9'; // default prefix
    expect(store.has(key)).toBe(true);
    expect(store.get(key)!.value.toString()).toBe('CUSTOM:9:Dave');
  });
});
