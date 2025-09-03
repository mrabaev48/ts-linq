import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';

@Entity({ name: 'users' })
class BenchUser {
  @PrimaryKey()
  id!: number;
  @Column({ type: 'INTEGER', nullable: false })
  age!: number;
  @Column({ type: 'TEXT', nullable: false })
  name!: string;
}

class BenchDb extends DbContext {}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

async function main() {
  const iterations = parseInt(process.env.BENCH_ITERS || '2000', 10);
  const rows = parseInt(process.env.BENCH_ROWS || '1000', 10);

  const ctx = new BenchDb({
    provider: 'sqlite',
    connectionString: ':memory:',
    performance: { enableCountCache: true, countCacheTtlMs: 10_000 }
  } as any);
  await (ctx as any)['provider'].connect();
  await (ctx as any)['provider'].executeNonQuery(
    'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)'
  );
  // seed
  await ctx.beginTransaction();
  for (let i = 0; i < rows; i++) {
    await (ctx as any)['provider'].executeNonQuery('INSERT INTO users(name, age) VALUES (?, ?)', [
      `user_${i}`,
      18 + (i % 50)
    ]);
  }
  await ctx.commitTransaction();

  const durationsSelect: number[] = [];
  const durationsCount: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const t1 = process.hrtime.bigint();
    // alternating predicates to exercise caches
    const age = 18 + (i % 50);
    const list = await ctx
      .set(BenchUser)
      .where((u) => u.age >= age)
      .orderBy((u) => u.id)
      .take(10)
      .toArray();
    const t2 = process.hrtime.bigint();
    durationsSelect.push(Number(t2 - t1) / 1_000_000);

    const t3 = process.hrtime.bigint();
    const c = await ctx.set(BenchUser).where((u) => u.age >= age).count();
    const t4 = process.hrtime.bigint();
    durationsCount.push(Number(t4 - t3) / 1_000_000);
    if (!list || typeof c !== 'number') throw new Error('bench sanity');
  }

  function stats(name: string, values: number[]) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    console.log(
      `${name}: n=${values.length}, avg=${avg.toFixed(2)}ms, p95=${percentile(values, 0.95).toFixed(
        2
      )}ms, p99=${percentile(values, 0.99).toFixed(2)}ms`
    );
  }

  stats('select(10)', durationsSelect);
  stats('count()', durationsCount);

  await (ctx as any)['provider'].disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


