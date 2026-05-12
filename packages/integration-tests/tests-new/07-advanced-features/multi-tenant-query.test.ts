
import { TestProvider } from '@ts-linq/testkits';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'tenant_items' })
class TenantItem {
    @PrimaryKey({ autoIncrement: true })
    id!: number;
    @Column()
    tenantId!: string;
    @Column()
    name!: string;
}

class TenantContext extends DbContext {
    constructor(provider: TestProvider, tenantId: string) {
        super({ 
            provider,
            globalFilters: [
                { 
                    filterName: 'TenantFilter',
                    entity: TenantItem as any,
                    where: {
                        condition: 'tenantId = ?',
                        parameters: [tenantId]
                    }
                }
            ]
        });
    }
}

describe('Advanced Features - Multi-Tenant (Global Filters)', () => {
    let provider: TestProvider;

    beforeEach(async () => {
        provider = new TestProvider(':memory:');
        const ctx = new TenantContext(provider, 'A');
        await ctx.ensureCreated();
        
        // Seed using provider directly
        await provider.insertMany([
            { tenantId: 'A', name: 'ItemA1' },
            { tenantId: 'B', name: 'ItemB1' },
            { tenantId: 'A', name: 'ItemA2' }
        ], TenantItem);
    });

    afterEach(async () => {
        await provider.disconnect();
    });

    it('should filter by tenant', async () => {
        const ctxA = new TenantContext(provider, 'A');
        const itemsA = await ctxA.set(TenantItem).toArray();
        
        expect(itemsA).toHaveLength(2);
        expect(itemsA.every(x => x.tenantId === 'A')).toBe(true);

        const ctxB = new TenantContext(provider, 'B');
        const itemsB = await ctxB.set(TenantItem).toArray();
        expect(itemsB).toHaveLength(1);
        expect(itemsB[0].tenantId).toBe('B');
    });
});
