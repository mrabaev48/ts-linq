import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineEntities() {
  @Entity()
  class A {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  @Entity()
  class B {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'INTEGER', nullable: false }) aId!: number;
  }
  return { A, B };
}

class Ctx extends DbContext {
  public as!: DbSet<any>;
  public bs!: DbSet<any>;
  constructor() { super({ provider: 'sqlite', connectionString: ':memory:' }); }
}

describe('Extended LINQ: subqueries and unions', () => {
  let ctx: Ctx;
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const { A, B } = defineEntities();
    ctx = new Ctx();
    await ctx.ensureCreated();
    const a1 = new (A as any)(); a1.name = 'x';
    const a2 = new (A as any)(); a2.name = 'y';
    (ctx as any)['as'].add(a1); (ctx as any)['as'].add(a2);
    await ctx.saveChanges();
    const b1 = new (B as any)(); b1.aId = a1.id;
    (ctx as any)['bs'].add(b1);
    await ctx.saveChanges();
  });
  afterEach(async () => { await ctx.dispose(); });

  it('whereInSubquery selects As that have Bs', async () => {
    const sub = (ctx as any)['bs'].where((b: any) => true).select((b: any) => ({ aId: b.aId } as any));
    const result = await (ctx as any)['as'].whereInSubquery('id' as any, sub).toArray();
    expect(result.length).toBe(1);
  });

  it('union and unionAll basic', async () => {
    const q1 = (ctx as any)['as'].where((a: any) => a.name === 'x');
    const q2 = (ctx as any)['as'].where((a: any) => a.name === 'y');
    const res = await q1.clone().union(q2).toArray();
    expect(res.length).toBe(2);
  });
});


