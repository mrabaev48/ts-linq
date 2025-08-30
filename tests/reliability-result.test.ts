import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';

@Entity({ name: 'Items' })
class Item { @PrimaryKey({ autoIncrement: true }) id!: number; @Column({ type: 'TEXT', nullable: false }) name!: string; }

class TestContext extends DbContext {
    public items!: any; // auto DbSet
    constructor() { super({ connectionString: ':memory:', provider: 'sqlite' }); }
}

describe('Result-based try methods', () => {
    test('trySaveChanges returns ok on success', async () => {
        // Ensure metadata is rehydrated before context initialization
        new Item();
        const ctx = new TestContext();
        await ctx.ensureCreated();
        ctx.set(Item).add({ name: 'ok' } as any);
        const res = await ctx.trySaveChanges();
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value).toBeGreaterThan(0);
        await ctx.dispose();
    });
});


