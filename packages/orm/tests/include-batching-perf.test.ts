import 'reflect-metadata';
import { DbContext } from '@ts-linq/orm/src/context/DbContext';
import { ProviderStub } from './_stubs/ProviderStub';
import { Entity } from '@ts-linq/core';
import { PrimaryKey } from '@ts-linq/core';
import { Column } from '@ts-linq/core';
import { OneToMany, ManyToOne } from '@ts-linq/core';
import { SqlLogger } from '../src/types';

@Entity({ name: 'PerfAuthors' })
class PerfAuthor {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
  @OneToMany(() => PerfBook, { foreignKey: 'authorId' }) books!: PerfBook[];
}

@Entity({ name: 'PerfBooks' })
class PerfBook {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) title!: string;
  @Column({ type: 'INTEGER', nullable: false }) authorId!: number;
  @ManyToOne(() => PerfAuthor, { foreignKey: 'authorId' }) author!: PerfAuthor;
}

class PerfCtx extends DbContext {
  public perfauthors!: {
    add: (a: PerfAuthor) => void;
    include: (sel: (a: PerfAuthor) => unknown) => { toArray: () => Promise<PerfAuthor[]> };
  };
  public perfbooks!: { add: (b: PerfBook) => void };
  constructor(logger?: SqlLogger) {
    super({
      provider: new ProviderStub(':memory:', logger) as unknown as 'sqlite',
      logger
    });
  }
}

describe('Include batching performance', () => {
  test('one-to-many include is batched into a single IN query (no N+1)', async () => {
    const events: Array<{ t: 'start' | 'end'; sql?: string }> = [];
    const logger: SqlLogger = {
      queryStart: (i) => events.push({ t: 'start', ...i }),
      queryEnd: (i) => events.push({ t: 'end', ...i })
    };

    // Ensure decorators are applied
    new PerfAuthor();
    new PerfBook();
    const ctx = new PerfCtx(logger);
    await ctx.ensureCreated();

    // Seed 10 authors + 10 books
    for (let i = 0; i < 10; i++) {
      const a = new PerfAuthor();
      a.name = `A${i}`;
      ctx.set(PerfAuthor).add(a);
      await ctx.saveChanges();
      const b = {
        title: `B${i}`,
        authorId: (a as unknown as { id: number }).id
      } as unknown as PerfBook;
      ctx.set(PerfBook).add(b as unknown as PerfBook);
      await ctx.saveChanges();
    }

    // Reset logger events before the measured query
    events.length = 0;

    // Run include query expected to batch
    const authors = await ctx
      .set(PerfAuthor)
      .include((a: PerfAuthor) => a.books)
      .toArray();
    expect(authors.length).toBe(10);

    // Count SELECT statements during the measured operation
    const starts = events.filter((e) => e.t === 'start' && /^SELECT/i.test(e.sql || '')).length;
    // Expect 2 selects: one for authors, one batched IN for books
    expect(starts).toBe(2);

    await ctx.dispose();
  });
});
