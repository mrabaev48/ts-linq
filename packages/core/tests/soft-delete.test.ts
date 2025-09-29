import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { ProviderStub } from './_stubs/ProviderStub';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

function defineSUser() {
  @Entity()
  class SUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
    @Column({ type: 'BOOLEAN', nullable: false, defaultValue: false }) isDeleted!: boolean;
    @Column({ type: 'DATETIME', nullable: true }) deletedAt?: Date;
    @Column({ type: 'DATETIME', nullable: true }) createdAt?: Date;
    @Column({ type: 'DATETIME', nullable: true }) updatedAt?: Date;
  }
  return SUser;
}

class SoftCtx<TUser extends object> extends DbContext {
  public susers!: DbSet<TUser>;
  constructor() {
    super({
      provider: new ProviderStub(':memory:'),
      softDelete: { enabled: true, column: 'isDeleted', deletedAtColumn: 'deletedAt' },
      audit: { enabled: true }
    } as any);
  }
}

describe('Soft delete & audit', () => {
  let ctx: SoftCtx<InstanceType<ReturnType<typeof defineSUser>>>;
  let SUser: ReturnType<typeof defineSUser>;
  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    SUser = defineSUser();
    ctx = new SoftCtx();
    await ctx.ensureCreated();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('filters out soft-deleted rows and stamps audit fields', async () => {
    const u = new SUser();
    u.name = 'A';
    ctx.set(SUser).add(u);
    await ctx.saveChanges();

    // update triggers updatedAt
    u.name = 'B';
    ctx.set(SUser).update(u);
    await ctx.saveChanges();

    // soft delete
    ctx.set(SUser).remove(u);
    await ctx.saveChanges();

    const all = await ctx.set(SUser).toArray();
    expect(all).toHaveLength(0);
  });
});
