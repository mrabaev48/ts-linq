
import { TestProvider } from '@ts-linq/testkits';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'cursor_items' })
class CursorItem {
    @PrimaryKey({ autoIncrement: true })
    id!: number;
}

class CursorContext extends DbContext {
    constructor(provider: TestProvider) {
        super({ provider });
    }
}

function toCursor(id: number) { return Buffer.from(String(id)).toString('base64'); }
function fromCursor(c: string) { return Number(Buffer.from(c, 'base64').toString('ascii')); }

describe('Pagination Integration - Cursor', () => {
    let provider: TestProvider;
    let context: CursorContext;

    beforeEach(async () => {
        provider = new TestProvider(':memory:');
        context = new CursorContext(provider);
        await context.ensureCreated();

        const items = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
        await provider.insertMany(items, CursorItem);
    });

    afterEach(async () => {
        await context.dispose();
    });

    it('should paginate using opaque cursors', async () => {
        // Page 1
        const page1 = await context.set(CursorItem).query().take(5).orderBy('id').toArray();
        const cursor = toCursor(page1[page1.length - 1].id);

        // Page 2
        const lastId = fromCursor(cursor);
        const page2 = await context.set(CursorItem)
            .query()
            .orderBy('id')
            .skip(lastId)
            .take(5)
            .toArray();

        expect(page2).toHaveLength(5);
        expect(page2[0].id).toBe(6);
    });
});
