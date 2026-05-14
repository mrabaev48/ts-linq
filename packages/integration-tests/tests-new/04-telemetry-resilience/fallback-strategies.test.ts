
import { TestProvider } from '@ts-linq/testkits';
import { DatabaseError } from '@ts-linq/types';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';
import { MemoryFallback } from '@ts-linq/query';
import '@ts-linq/query'; // Import index to ensure extensions are loaded if they exist


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
        items.add({ id: 1, name: 'FromDB' } as Item);
        await context.saveChanges();

        // Setup fallback with different data
        fallback = new MemoryFallback<Item>(() => [
            { id: 1, name: 'FromMemory' } as Item,
            { id: 2, name: 'MemoryOnly' } as Item
        ]);
    });

    afterEach(async () => {
        await context.dispose();
    });

    it('should use primary if healthy', async () => {
        const result = await (context.set(Item) as any)
            .fallbackTo(fallback)
            .toArray();

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('FromDB');
    });

    it('should use fallback if primary fails', async () => {
        provider.shouldFail = true;

        const result = await (context.set(Item) as any)
            .fallbackTo(fallback)
            .toArray();

        // Should return data from memory fallback
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('FromMemory');
    });

    it.skip('should support predicates in fallback', async () => {
        provider.shouldFail = true;

        const result = await (context.set(Item) as any)
            .fallbackTo(fallback)
            .where((x: any) => x.id === 2)
            .toArray();

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('FromMemory');
    });

    it('should count from fallback if primary fails', async () => {
        provider.shouldFail = true;

        const count = await (context.set(Item) as any)
            .fallbackTo(fallback)
            .count();
        
        expect(count).toBe(2);
    });
});
