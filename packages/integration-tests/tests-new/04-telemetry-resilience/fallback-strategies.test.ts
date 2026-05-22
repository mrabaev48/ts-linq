import '@ts-linq/query'; // Import index to ensure extensions are loaded if they exist

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { MemoryFallback } from '@ts-linq/query/internal';
import { TestProvider } from '@ts-linq/testkits';
import { DatabaseError } from '@ts-linq/types';

class FaultyProvider extends TestProvider {
  public shouldFail = false;
  public async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.shouldFail) throw new DatabaseError('Connection timeout');
    return super.doExecuteQuery(sql, params);
  }
}

@Entity({ name: 'fallback_items' })
class Item {
  @PrimaryKey()
  id!: number;
  @Column()
  name!: string;
}

class TestContext extends DbContext {
  constructor(provider: TestProvider) {
    super({ provider });
  }
}

describe('Telemetry Integration - Fallback Strategies', () => {
  let provider: FaultyProvider;
  let context: TestContext;
  let fallback: MemoryFallback<Item>;

  beforeEach(async () => {
    provider = new FaultyProvider(':memory:');
    context = new TestContext(provider);
    await context.ensureCreated();

    // Seed primary
    const items = context.set(Item);
    items.add({ id: 1, name: 'FromDB' });
    await context.saveChanges();

    // Setup fallback with different data
    fallback = new MemoryFallback<Item>(() => [
      { id: 1, name: 'FromMemory' },
      { id: 2, name: 'MemoryOnly' }
    ]);
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should use primary if healthy', async () => {
    const result = await (context.set(Item) as any).fallbackTo(fallback).toArray();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('FromDB');
  });

  it('should use fallback if primary fails', async () => {
    provider.shouldFail = true;

    const result = await (context.set(Item) as any).fallbackTo(fallback).toArray();

    // Should return data from memory fallback
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('FromMemory');
  });

  it('should support predicates in fallback', async () => {
    provider.shouldFail = true;

    const result = await (context.set(Item) as any)
      .fallbackTo(fallback)
      .whereCompiled({
        ast: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'id' },
          right: { type: 'literal', value: 2 }
        },
        parameters: []
      })
      .toArray();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('FromMemory');
  });

  it('should count from fallback if primary fails', async () => {
    provider.shouldFail = true;

    const count = await (context.set(Item) as any).fallbackTo(fallback).count();

    expect(count).toBe(2);
  });
});
