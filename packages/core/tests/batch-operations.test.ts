import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineB() {
  @Entity()
  class BUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { BUser };
}

class BCtx extends DbContext {
  public busers!: DbSet<InstanceType<ReturnType<typeof defineB>['BUser']>>;
  constructor() {
    super({ provider: 'sqlite', connectionString: ':memory:' });
  }
}

describe('Batch operations using base provider', () => {
  let BUser: ReturnType<typeof defineB>['BUser'];
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const e = defineB();
    BUser = e.BUser;
  });

  it('insertMany and updateMany work in a transaction', async () => {
    const ctx = new BCtx();
    await ctx.ensureCreated();
    const users = Array.from({ length: 5 }, (_, i) => {
      const u = new BUser();
      u.name = `U${i + 1}`;
      return u;
    });
    await expect(ctx.set(BUser).insertMany(users)).resolves.toHaveLength(5);

    // mutate
    users.forEach((u) => (u.name = `${u.name}!`));
    await expect(ctx.set(BUser).updateMany(users)).resolves.toHaveLength(5);

    const rows = await ctx
      .set(BUser)
      .orderBy((x) => x.id)
      .toArray();
    expect(rows.map((r) => r.name)).toEqual(['U1!', 'U2!', 'U3!', 'U4!', 'U5!']);
    await ctx.dispose();
  });
});
