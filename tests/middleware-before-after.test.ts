import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { OrmMiddleware } from '../src/types';

function defineBM() {
  @Entity()
  class MWB {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { MWB };
}

class MWCtx2 extends DbContext {
  public mwbs!: DbSet<InstanceType<ReturnType<typeof defineBM>['MWB']>>;
  constructor(middlewares: OrmMiddleware[]) {
    super({ provider: 'sqlite', connectionString: ':memory:', middlewares });
  }
}

describe('Middleware beforeExecute/afterExecute', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('fires before and after for queries and non-queries with traceId/rows', async () => {
    const { MWB } = defineBM();
    const before: string[] = [];
    const after: string[] = [];
    const seenTraceIds: Array<string | undefined> = [];
    const seenRows: Array<number | undefined> = [];
    const mw: OrmMiddleware = {
      beforeExecute: async (info) => {
        before.push(info.sql);
        seenTraceIds.push(info.traceId);
      },
      afterExecute: async (info) => {
        after.push(info.sql);
        seenTraceIds.push(info.traceId);
        seenRows.push(info.rows);
      }
    };
    const ctx = new MWCtx2([mw]);
    await ctx.ensureCreated();
    // откроем и закроем транзакцию для генерации traceId
    await ctx.beginTransaction();
    await ctx.commitTransaction();
    const a = new MWB();
    a.name = 'A';
    ctx.mwbs.add(a);
    await ctx.saveChanges();
    await ctx.set(MWB).toArray();

    expect(before.length).toBeGreaterThanOrEqual(2);
    expect(after.length).toBeGreaterThanOrEqual(2);
    expect(seenTraceIds.some((id) => typeof id === 'string')).toBe(true);
    expect(seenRows.some((r) => typeof r === 'number')).toBe(true);
    await ctx.dispose();
  });
});
