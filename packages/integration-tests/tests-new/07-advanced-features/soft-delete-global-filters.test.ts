
import { TestProvider } from '@ts-linq/testkits';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'sd_items' })
class SdItem {
    @PrimaryKey({ autoIncrement: true })
    id!: number;
    
    @Column()
    name!: string;

    @Column({ defaultValue: false })
    isDeleted!: boolean;
}

class SdContext extends DbContext {
    constructor(provider: TestProvider) {
        super({ 
            provider,
            softDelete: { enabled: true, column: 'isDeleted' }
        });
    }
}

describe('Advanced Features - Soft Delete', () => {
    let provider: TestProvider;
    let context: SdContext;

    beforeEach(async () => {
        provider = new TestProvider({ file: ':memory:' });
        context = new SdContext(provider);
        await context.ensureCreated();

        // Seed
        const items = context.set(SdItem);
        items.add({ name: 'Item1' } as SdItem);
        items.add({ name: 'Item2' } as SdItem);
        await context.saveChanges();
    });

    afterEach(async () => {
        await context.dispose();
    });

    it('should soft delete entities', async () => {
        const item = await context.set(SdItem).first();
        context.set(SdItem).remove(item!);
        await context.saveChanges();

        // Verify it's gone from normal query
        const all = await context.set(SdItem).toArray();
        expect(all).toHaveLength(1);
        expect(all[0].name).toBe('Item2');

        // Verify it's still in DB as deleted
        const raw = await provider.executeQuery("SELECT * FROM sd_items WHERE isDeleted = 1");
        expect(raw).toHaveLength(1);
    });

    it('should filter deleted items in queries', async () => {
        // Manually insert deleted item
        await provider.executeNonQuery("INSERT INTO sd_items (name, isDeleted) VALUES ('DeletedItem', 1)");

        const count = await context.set(SdItem).count();
        expect(count).toBe(2); // Item1, Item2 (Item1 not deleted yet in this test)
    });
});
