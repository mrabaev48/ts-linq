import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';

function defineEntitiesV1() {
  @Entity({ name: 'RUsers' })
  class RUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { RUser };
}

class RCtx extends DbContext {
  public rusers!: DbSet<any>;
  constructor() {
    super({ provider: 'sqlite', connectionString: ':memory:' });
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
    nameCol.type = 'INTEGER' as any;

    const gen = new DiffMigrationGenerator((ctx as any).provider);
    const steps = await gen.generate();
    const sqls = steps.map((s) => s.sql).join('\n');
    expect(sqls).toMatch(/CREATE TABLE IF NOT EXISTS __new_RUsers/i);
    expect(sqls).toMatch(/INSERT INTO __new_RUsers/i);
    expect(sqls).toMatch(/DROP TABLE RUsers/i);
    expect(sqls).toMatch(/RENAME TO RUsers/i);
    await ctx.dispose();
  });
});
