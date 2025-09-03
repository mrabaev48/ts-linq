import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';

function defineEntities() {
  @Entity({ name: 'DUsers' })
  class DUser {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
  }
  return { DUser };
}

class DCtx extends DbContext {
  public dusers!: DbSet<any>;
  constructor() {
    super({ provider: 'sqlite', connectionString: ':memory:' });
  }
}

describe('Schema diff migration (SQLite minimal)', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('generates CREATE TABLE or ADD COLUMN steps', async () => {
    const { DUser } = defineEntities();
    const ctx = new DCtx();
    await ctx.ensureCreated();

    const gen = new DiffMigrationGenerator((ctx as any).provider);
    const steps = await gen.generate();
    expect(Array.isArray(steps)).toBe(true);
    // Since provider.createTable was used during ensureCreated, table exists, so steps may be empty or ALTERs
    // We add a new property to force ADD COLUMN
    (MetadataStorage.getEntity(DUser) as any).columns.push({
      propertyName: 'age',
      columnName: 'age',
      type: 'INTEGER',
      nullable: true
    });
    const steps2 = await gen.generate();
    expect(steps2.some((s) => /ALTER TABLE DUsers ADD COLUMN age/i.test(s.sql))).toBe(true);
    await ctx.dispose();
  });
});
