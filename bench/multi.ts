import { DbContext } from '../src/context/DbContext';
import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';

type ProviderKey = 'sqlite' | 'postgresql' | 'mysql';

@Entity({ name: 'users' })
class BenchUser {
  @PrimaryKey({ autoIncrement: true })
  id!: number;
  @Column({ type: 'TEXT', nullable: false })
  name!: string;
  @Column({ type: 'INTEGER', nullable: false })
  age!: number;
}

class BenchCtx extends DbContext {
  public users = this.set(BenchUser);
}

function nowMs(): number { return Number(process.hrtime.bigint() / BigInt(1_000_000)); }

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

async function ensureSchema(ctx: BenchCtx) {
  const prov = (ctx as unknown as { provider?: unknown })['provider'] as
    | { providerKey?: ProviderKey; connect: () => Promise<void>; executeNonQuery: (sql: string, params?: unknown[]) => Promise<number> }
    | undefined;
  const provider: ProviderKey = prov?.providerKey ?? 'sqlite';
  if (provider === 'sqlite') {
    await prov.connect();
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL)');
  } else if (provider === 'postgresql') {
    await prov.connect();
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL)');
  } else if (provider === 'mysql') {
    await prov.connect();
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery('CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, age INT NOT NULL)');
  }
}

async function seed(ctx: BenchCtx, rows: number) {
  await ctx.beginTransaction();
  for (let i = 0; i < rows; i++) {
    const prov = (ctx as unknown as { provider?: unknown })['provider'] as {
      executeNonQuery: (sql: string, params?: unknown[]) => Promise<number>;
    };
    await prov.executeNonQuery('INSERT INTO users(name, age) VALUES (?, ?)', [
      `user_${i}`,
      18 + (i % 50)
    ]);
  }
  await ctx.commitTransaction();
}

async function runScenarios(ctx: BenchCtx, iterations: number) {
  const durations: Record<string, number[]> = {
    select10: [],
    count: [],
    paginate_offset: [],
    paginate_keyset: []
  };

  for (let i = 0; i < iterations; i++) {
    const age = 18 + (i % 50);

    let t = nowMs();
    await ctx.users.where((u) => u.age >= age).orderBy((u) => u.id).take(10).toArray();
    durations.select10.push(nowMs() - t);

    t = nowMs();
    await ctx.users.where((u) => u.age >= age).count();
    durations.count.push(nowMs() - t);

    t = nowMs();
    await ctx.users.orderBy((u) => u.id).skip((i % 10) * 10).take(10).toArray();
    durations.paginate_offset.push(nowMs() - t);

    const after = i % 2 === 0 ? (i % 100) : null;
    t = nowMs();
    await ctx.users.orderBy((u) => u.id).keysetPaginate('id', after, 10);
    durations.paginate_keyset.push(nowMs() - t);
  }
  return durations;
}

function output(provider: ProviderKey, fmt: 'csv' | 'json', durations: Record<string, number[]>) {
  const stats = Object.fromEntries(
    Object.entries(durations).map(([k, v]) => [k, {
      n: v.length,
      avg: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length),
      p95: percentile(v, 0.95),
      p99: percentile(v, 0.99)
    }])
  );
  if (fmt === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ provider, stats }));
  } else {
    // eslint-disable-next-line no-console
    console.log(`provider,scenario,n,avg_ms,p95_ms,p99_ms`);
    for (const [k, s] of Object.entries(stats)) {
      // eslint-disable-next-line no-console
      console.log(`${provider},${k},${s.n},${s.avg.toFixed(2)},${s.p95.toFixed(2)},${s.p99.toFixed(2)}`);
    }
  }
}

async function runForProvider(provider: ProviderKey, conn: string | undefined, fmt: 'csv' | 'json', rows: number, iters: number) {
  if (!conn && provider !== 'sqlite') {
    // eslint-disable-next-line no-console
    console.log(`# skipping ${provider}: no connection string`);
    return;
  }
  const ctx = new BenchCtx({
    provider,
    connectionString: provider === 'sqlite' ? ':memory:' : (conn as string),
    performance: { enableCountCache: true, countCacheTtlMs: 10_000 }
  });
  await ensureSchema(ctx);
  await seed(ctx, rows);
  const durations = await runScenarios(ctx, iters);
  output(provider, fmt, durations);
  const prov = (ctx as unknown as { provider?: { disconnect: () => Promise<void> } })['provider'];
  await prov?.disconnect();
}

async function main() {
  const fmt: 'csv' | 'json' = process.env.BENCH_FORMAT === 'json' ? 'json' : 'csv';
  const rows = parseInt(process.env.BENCH_ROWS || '5000', 10);
  const iters = parseInt(process.env.BENCH_ITERS || '2000', 10);
  const providers = (process.env.BENCH_PROVIDERS || 'sqlite').split(',') as ProviderKey[];
  const pg = process.env.POSTGRES_URL;
  const mysql = process.env.MYSQL_URL;
  for (const p of providers) {
    if (p === 'sqlite') await runForProvider('sqlite', undefined, fmt, rows, iters);
    if (p === 'postgresql') await runForProvider('postgresql', pg, fmt, rows, iters);
    if (p === 'mysql') await runForProvider('mysql', mysql, fmt, rows, iters);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


