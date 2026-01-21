
import { TestProvider } from '@ts-linq/testkits';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'keyset_items' })
class KeysetItem {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    val!: number;
}

class KeysetContext extends DbContext {
    constructor(provider: TestProvider) {
        super({ provider });
    }
}

describe('Pagination Integration - Keyset', () => {
    let provider: TestProvider;
    let context: KeysetContext;

    beforeEach(async () => {
        provider = new TestProvider(':memory:');
        context = new KeysetContext(provider);
        await context.ensureCreated();

        // Seed 20 items
        const items = [];
        for (let i = 1; i <= 20; i++) {
            items.push({ val: i });
        }
        await provider.insertMany(items, KeysetItem);
    });

    afterEach(async () => {
        await context.dispose();
    });

    it('should fetch next page using last id', async () => {
        // Page 1
        const page1 = await context.set(KeysetItem)
            .orderBy(x => x.id)
            .take(5)
            .toArray();
        
        expect(page1).toHaveLength(5);
        const lastId = page1[page1.length - 1].id;
        expect(lastId).toBe(5);

        // Page 2 (Keyset)
        const page2 = await context.set(KeysetItem)
            .where(x => x.id > lastId)
            .orderBy(x => x.id)
            .take(5)
            .toArray();

        expect(page2).toHaveLength(5);
        expect(page2[0].id).toBe(6);
    });

    it('should handle end of data', async () => {
        const lastId = 20;
        const page = await context.set(KeysetItem)
            .where(x => x.id > lastId)
            .orderBy(x => x.id)
            .take(5)
            .toArray();
        
        expect(page).toHaveLength(0);
    });
});
