
import { TestProvider } from '@ts-linq/testkits';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'page_items' })
class PageItem {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    value!: number;
}

class PageContext extends DbContext {
    constructor(provider: TestProvider) {
        super({ provider });
    }
}

describe('Pagination Integration - Offset', () => {
    let provider: TestProvider;
    let context: PageContext;

    beforeEach(async () => {
        provider = new TestProvider({ file: ':memory:' });
        context = new PageContext(provider);
        await context.ensureCreated();

        // Seed 20 items
        const items = [];
        for (let i = 1; i <= 20; i++) {
            items.push({ value: i });
        }
        await provider.insertMany(items, PageItem);
    });

    afterEach(async () => {
        await context.dispose();
    });

    it('should skip and take', async () => {
        const page = await context.set(PageItem)
            .query()
            .orderBy('value')
            .skip(5)
            .take(5)
            .toArray();

        expect(page).toHaveLength(5);
        expect(page[0].value).toBe(6);
        expect(page[4].value).toBe(10);
    });

    it('should paginate to end', async () => {
        const page = await context.set(PageItem)
            .query()
            .orderBy('value')
            .skip(15)
            .take(10)
            .toArray();

        expect(page).toHaveLength(5); // Only 5 left (16..20)
        expect(page[0].value).toBe(16);
        expect(page[4].value).toBe(20);
    });
});
