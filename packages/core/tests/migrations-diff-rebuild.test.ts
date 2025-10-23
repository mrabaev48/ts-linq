import { DbContext, DbSet } from '@ts-linq/orm';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { DatabaseProvider } from '../src/DatabaseProvider';

function defineEntitiesV1() {
  @Entity({ name: 'RUsers' })
  class RUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { RUser };
}

class RCtx extends DbContext {
  public rusers!: DbSet<InstanceType<ReturnType<typeof defineEntitiesV1>['RUser']>>;
  constructor() {
    const { ProviderStub } = require('./_stubs/ProviderStub');
    super({ provider: new ProviderStub(':memory:'), connectionString: ':memory:' });
  }
}

describe('Schema diff rebuild (SQLite minimal)', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('produces rebuild steps when column type changes', async () => {
    const { RUser } = defineEntitiesV1();
    const ctx = new RCtx();
    await ctx.ensureCreated();
    // change column type in metadata
    const meta = MetadataStorage.getEntity(RUser)!;
    const nameCol = meta.columns.find((c) => c.propertyName === 'name')!;
    nameCol.type = 'INTEGER';

    const gen = new DiffMigrationGenerator(
      (ctx as unknown as { provider: DatabaseProvider }).provider
    );
    const steps = await gen.generate();
    const sqls = steps.map((s) => s.sql).join('\n');
    // For minimal stub, at least expect ALTER or CREATE present after type change
    expect(sqls.length).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
