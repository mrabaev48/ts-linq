import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OrmMiddleware } from '../src/types';

function defineE() {
  @Entity()
  class MW {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { MW };
}

class MWCtx extends DbContext {
  public mws!: DbSet<InstanceType<ReturnType<typeof defineE>['MW']>>;
  constructor(middlewares: OrmMiddleware[]) {
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({
      provider: new ProviderStub(':memory:', undefined, middlewares)
    });
  }
}

describe('Middleware entityMaterialized hook', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('fires entityMaterialized for each materialized row', async () => {
    const { MW } = defineE();
    const seen: Array<{ name: string }> = [];
    const mw: OrmMiddleware = {
      entityMaterialized: async ({ entity }) => {
        seen.push(entity as { name: string });
      }
    };
    const ctx = new MWCtx([mw]);
    await ctx.ensureCreated();
    const a = new MW();
    a.name = 'A';
    ctx.set(MW).add(a);
    const b = new MW();
    b.name = 'B';
    ctx.set(MW).add(b);
    await ctx.saveChanges();

    const rows = await ctx
      .set(MW)
      .orderBy((x) => x.id)
      .toArray();
    expect(rows).toHaveLength(2);
    // entityMaterialized может быть асинхронным — подождём микротаск-тик
    await new Promise((res) => setTimeout(res, 0));
    expect(seen.map((e) => e.name).sort()).toEqual(['A', 'B']);
    await ctx.dispose();
  });
});
