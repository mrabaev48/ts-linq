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
  public as!: DbSet<InstanceType<ReturnType<typeof defineEntities>['A']>>;
  public bs!: DbSet<InstanceType<ReturnType<typeof defineEntities>['B']>>;
  constructor() {
    super({ provider: 'sqlite', connectionString: ':memory:' });
  }
}

describe('Extended LINQ: subqueries and unions', () => {
  let ctx: Ctx;
  let A: ReturnType<typeof defineEntities>['A'];
  let B: ReturnType<typeof defineEntities>['B'];
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const e = defineEntities();
    A = e.A;
    B = e.B;
    ctx = new Ctx();
    await ctx.ensureCreated();
    const a1 = new A();
    a1.name = 'x';
    const a2 = new A();
    a2.name = 'y';
    (ctx as unknown as { as: DbSet<InstanceType<typeof A>> }).as.add(a1);
    (ctx as unknown as { as: DbSet<InstanceType<typeof A>> }).as.add(a2);
    await ctx.saveChanges();
    const b1 = new B();
    b1.aId = a1.id;
    (ctx as unknown as { bs: DbSet<InstanceType<typeof B>> }).bs.add(b1);
    await ctx.saveChanges();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('whereInSubquery selects As that have Bs', async () => {
    const sub = (ctx as unknown as { bs: DbSet<InstanceType<typeof B>> }).bs
      .where(() => true)
      .select((b) => ({ aId: (b as { aId: number }).aId }));
    const result = await (ctx as unknown as { as: DbSet<InstanceType<typeof A>> }).as
      .whereInSubquery('id', sub)
      .toArray();
    expect(result.length).toBe(1);
  });

  it('union and unionAll basic', async () => {
    const q1 = (ctx as unknown as { as: DbSet<InstanceType<typeof A>> }).as.where(
      (a) => a.name === 'x'
    );
    const q2 = (ctx as unknown as { as: DbSet<InstanceType<typeof A>> }).as.where(
      (a) => a.name === 'y'
    );
    const res = await q1.clone().union(q2).toArray();
    expect(res.length).toBe(2);
  });
});
