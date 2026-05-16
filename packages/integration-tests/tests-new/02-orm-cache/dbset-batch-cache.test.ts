
import { DbContext, DbSet } from '@ts-linq/orm';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { TestProvider as MockProvider } from '@ts-linq/testkits';

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  public id!: number;

  @Column()
  public name!: string;

  @Column({ type: 'INTEGER' })
  public age!: number;
}

class TestCountCache {
  private _size = 0;
  public get(key: string) { return undefined; }
  public set(key: string, value: any) { 
      this._size++; 
      console.log('Cache set:', key); 
  }
  public clear() { this._size = 0; }
  public invalidateBy(matcher: (key: string) => boolean) { 
      let removed = 0;
      // In a real map we would iterate keys. 
      // Here we just simulate we removed everything for simplicity,
      // Or we can just log.
      // Since we only track size, let's reset size if matcher is permissive.
      // But typically invalidator is prefix based.
      // Let's just say we cleared it.
      if (this._size > 0) {
          this._size = 0;
          removed = 1;
      }
      return removed;
  }
  public size() { return this._size; }
}

describe('DbSet BatchOperations + Cache', () => {
  let provider: MockProvider;
  let countCache: TestCountCache;
  let context: DbContext;
  let users: DbSet<User>;

  beforeEach(() => {
    provider = new MockProvider();
    countCache = new TestCountCache();
    class TestDbContext extends DbContext {}
    context = new TestDbContext({
      provider,
      performance: {
        enableCountCache: true,
        countCache: countCache as any
      }
    });
    users = context.set(User);
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('upsertMany should invalidate count cache via ChangeTracker', async () => {
    // 1. Warm cache
    provider.nextResult = [{ count: 5 }];
    await users.query().count();
    expect(countCache.size()).toBe(1);

    // 2. upsertMany (mocking findWhereIn to return empty, so all are adds)
    provider.nextResult = []; // findWhereIn check for existence
    
    // We need insert mock to return something
    provider.insert = async (entity) => ({ ...entity, id: 1 });
    
    const newUsers = [
        Object.assign(new User(), { name: 'A', age: 10 }),
        Object.assign(new User(), { name: 'B', age: 20 })
    ];
    
    await users.upsertMany(newUsers);
    // upsertMany just adds to tracker. Need saveChanges.
    await context.saveChanges();
    
    // 3. Should be invalidated
    expect(countCache.size()).toBe(0);
  });
  
  it('insertMany should invalidate count cache (Manual Check)', async () => {
     // 1. Warm cache
    provider.nextResult = [{ count: 5 }];
    await users.query().count();
    expect(countCache.size()).toBe(1);
    
    // 2. insertMany (bypasses ChangeTracker)
    provider.insertMany = async (entities) => entities;
    
    const newUsers = [
        Object.assign(new User(), { name: 'C', age: 30 })
    ];
    
    await users.insertMany(newUsers);
    
    // 3. EXPECTATION: Current implementation likely FAILS to invalidate
    expect(countCache.size()).toBe(0); 
  });
  
  it('updateMany should invalidate count cache (Manual Check)', async () => {
     // 1. Warm cache
     provider.nextResult = [{ count: 5 }];
    await users.query().count();
    expect(countCache.size()).toBe(1);
    
    // 2. updateMany (bypasses ChangeTracker)
    provider.updateMany = async (entities) => entities;
    
    // Mock user
    const user = Object.assign(new User(), { id: 1, name: 'D', age: 40 });
    
    await users.updateMany([user]);
    
    // 3. Expect invalidation
    expect(countCache.size()).toBe(0);
  });

});
