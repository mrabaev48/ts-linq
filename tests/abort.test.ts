import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';

@Entity({ name: 'A' })
class A { @PrimaryKey({ autoIncrement: true }) id!: number; @Column({ type: 'TEXT' }) name!: string; }

class Ctx extends DbContext { public a!: any; constructor() { super({ connectionString: ':memory:', provider: 'sqlite' }); } }

describe('Abortable queries', () => {
    test('withAbort throws when signal is already aborted', async () => {
        new A();
        const ctx = new Ctx();
        await ctx.ensureCreated();
        const c = new AbortController();
        c.abort();
        await expect(ctx.set(A).where(x => x.id > 0).withAbort(c.signal).toArray())
            .rejects.toThrow('Operation aborted');
        await ctx.dispose();
    });
});


