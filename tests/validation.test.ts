import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { ValidationError } from '../src/types';

@Entity({ name: 'ValUsers' })
class ValUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false, length: 5 }) name!: string;
}

class ValCtx extends DbContext {
  public valusers!: any;
  constructor() {
    super({ connectionString: ':memory:', provider: 'sqlite' });
  }
}

describe('Model validation', () => {
  test('saveChanges throws ValidationError on null and length violations', async () => {
    new ValUser();
    const ctx = new ValCtx();
    await ctx.ensureCreated();
    const u = new ValUser();
    // name is required
    ctx.valusers.add(u as any);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    // fix null but exceed length
    (u as any).name = 'too-long-name';
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    await ctx.dispose();
  });

  test('trySaveChanges returns Result with error', async () => {
    new ValUser();
    const ctx = new ValCtx();
    await ctx.ensureCreated();
    const u = new ValUser();
    ctx.valusers.add(u as any);
    const res = await ctx.trySaveChanges();
    expect(res.ok).toBe(false);
    await ctx.dispose();
  });
});
