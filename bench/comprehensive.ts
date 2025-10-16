import { DbContext } from '../packages/core/src/context/DbContext';
import { Entity } from '../packages/core/src/decorators/Entity';
import { Column } from '../packages/core/src/decorators/Column';
import { PrimaryKey } from '../packages/core/src/decorators/PrimaryKey';
import type { DatabaseProvider } from '../packages/core/src/DatabaseProvider';
import { SQLiteProvider } from '../packages/sqlite/src/SQLiteProvider';
import { PostgresProvider } from '../packages/postgres/src/PostgresProvider';
import { MySqlProvider } from '../packages/mysql/src/MySqlProvider';

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

interface ScenarioResultSummary {
  readonly n: number;
  readonly avg: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly min: number;
  readonly max: number;
  readonly totalMs: number;
  readonly opsPerSec: number;
}

interface ProviderRunResult {
  readonly provider: ProviderKey;
  readonly scenarios: Record<string, ScenarioResultSummary>;
  readonly rows: number;
  readonly iterations: number;
}

interface SuiteResult {
  readonly timestamp: number;
  readonly results: ProviderRunResult[];
  readonly config: {
    readonly providers: ProviderKey[];
    readonly rows: number;
    readonly iterations: number;
    readonly format: 'json' | 'csv';
  };
}

function nowMs(): number {
  return Number(process.hrtime.bigint() / BigInt(1_000_000));
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)));
  return sorted[idx];
}

function summarize(values: readonly number[], totalMs?: number): ScenarioResultSummary {
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = n > 0 ? sum / n : 0;
  const min = n > 0 ? Math.min(...values) : 0;
  const max = n > 0 ? Math.max(...values) : 0;
  const total = totalMs ?? sum;
  const opsPerSec = total > 0 ? (n / total) * 1000 : 0;
  return {
    n,
    avg,
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    min,
    max,
    totalMs: total,
    opsPerSec
  };
}

async function ensureSchema(ctx: BenchCtx, providerKey: ProviderKey): Promise<void> {
  // Use low-level exec to avoid dependency on migrations for synthetic bench workload
  const prov = (ctx as unknown as { provider?: DatabaseProvider }).provider as DatabaseProvider;
  await prov.connect();
  if (providerKey === 'sqlite') {
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery(
      'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL)'
    );
  } else if (providerKey === 'postgresql') {
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery(
      'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL)'
    );
  } else if (providerKey === 'mysql') {
    await prov.executeNonQuery('DROP TABLE IF EXISTS users');
    await prov.executeNonQuery(
      'CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, age INT NOT NULL)'
    );
  }
}

async function seed(ctx: BenchCtx, rows: number): Promise<void> {
  const prov = (ctx as unknown as { provider?: DatabaseProvider }).provider as DatabaseProvider;
  await ctx.beginTransaction();
  for (let i = 0; i < rows; i++) {
    await prov.executeNonQuery('INSERT INTO users(name, age) VALUES (?, ?)', [
      `user_${i}`,
      18 + (i % 50)
    ]);
  }
  await ctx.commitTransaction();
}

async function runScenarios(ctx: BenchCtx, iterations: number): Promise<Record<string, number[]>> {
  const durations: Record<string, number[]> = {
    select10: [],
    count: [],
    paginate_offset: [],
    paginate_keyset: [],
    insert_delete: []
  };

  // Warm-up a few iterations to stabilize JIT/caches
  for (let i = 0; i < Math.min(50, Math.floor(iterations / 10)); i++) {
    const age = 18 + (i % 50);
    await ctx.users
      .where((u) => u.age >= age)
      .orderBy((u) => u.id)
      .take(10)
      .toArray();
  }

  for (let i = 0; i < iterations; i++) {
    const age = 18 + (i % 50);

    let t = nowMs();
    await ctx.users
      .where((u) => u.age >= age)
      .orderBy((u) => u.id)
      .take(10)
      .toArray();
    durations.select10.push(nowMs() - t);

    t = nowMs();
    await ctx.users.where((u) => u.age >= age).count();
    durations.count.push(nowMs() - t);

    t = nowMs();
    await ctx.users
      .orderBy((u) => u.id)
      .skip((i % 10) * 10)
      .take(10)
      .toArray();
    durations.paginate_offset.push(nowMs() - t);

    const after = i % 2 === 0 ? i % 100 : null;
    t = nowMs();
    await ctx.users.orderBy((u) => u.id).keysetPaginate('id', after, 10);
    durations.paginate_keyset.push(nowMs() - t);

    // DML micro-benchmark: insert + delete within a transaction
    t = nowMs();
    await ctx.beginTransaction();
    const prov = (ctx as unknown as { provider?: DatabaseProvider }).provider as DatabaseProvider;
    await prov.executeNonQuery('INSERT INTO users(name, age) VALUES (?, ?)', [`tmp_${i}`, 30]);
    await prov.executeNonQuery('DELETE FROM users WHERE name = ?', [`tmp_${i}`]);
    await ctx.commitTransaction();
    durations.insert_delete.push(nowMs() - t);
  }
  return durations;
}

function outputCsv(result: SuiteResult): void {
  // eslint-disable-next-line no-console
  console.log('provider,scenario,n,avg_ms,p50_ms,p90_ms,p95_ms,p99_ms,min_ms,max_ms,ops_per_sec');
  for (const r of result.results) {
    for (const [name, s] of Object.entries(r.scenarios)) {
      // eslint-disable-next-line no-console
      console.log(
        `${r.provider},${name},${s.n},${s.avg.toFixed(2)},${s.p50.toFixed(2)},${s.p90.toFixed(
          2
        )},${s.p95.toFixed(2)},${s.p99.toFixed(2)},${s.min.toFixed(2)},${s.max.toFixed(
          2
        )},${s.opsPerSec.toFixed(2)}`
      );
    }
  }
}

function outputResult(result: SuiteResult, format: 'json' | 'csv', outPath?: string): void {
  if (outPath) {
    const fs = require('fs') as typeof import('fs');
    const dir = require('path').dirname(outPath) as string;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  }
  if (format === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  } else {
    outputCsv(result);
  }
}

function buildProvider(kind: ProviderKey, conn?: string): DatabaseProvider {
  if (kind === 'sqlite') return new SQLiteProvider(conn ?? ':memory:');
  if (kind === 'postgresql') return new PostgresProvider(conn ?? (process.env.POSTGRES_URL || ''));
  return new MySqlProvider(conn ?? (process.env.MYSQL_URL || ''));
}

async function runForProvider(
  providerKey: ProviderKey,
  rows: number,
  iters: number
): Promise<ProviderRunResult | null> {
  if (providerKey !== 'sqlite') {
    const envUrl = providerKey === 'postgresql' ? process.env.POSTGRES_URL : process.env.MYSQL_URL;
    if (!envUrl) {
      // eslint-disable-next-line no-console
      console.log(`# skipping ${providerKey}: no connection string in env`);
      return null;
    }
  }
  const provider = buildProvider(
    providerKey,
    providerKey === 'sqlite'
      ? ':memory:'
      : providerKey === 'postgresql'
        ? process.env.POSTGRES_URL
        : process.env.MYSQL_URL
  );
  const ctx = new BenchCtx({
    provider,
    performance: { enableCountCache: true, countCacheTtlMs: 10_000, inClauseChunkSize: 1000 }
  });
  await ensureSchema(ctx, providerKey);
  await seed(ctx, rows);
  const start = nowMs();
  const durations = await runScenarios(ctx, iters);
  const total = nowMs() - start;
  const scenarios = Object.fromEntries(
    Object.entries(durations).map(([k, arr]) => [k, summarize(arr, total)])
  );
  await (ctx as unknown as { dispose: () => Promise<void> }).dispose?.();
  return { provider: providerKey, scenarios, rows, iterations: iters };
}

async function main(): Promise<void> {
  const fmt: 'csv' | 'json' = process.env.BENCH_FORMAT === 'csv' ? 'csv' : 'json';
  const rows = parseInt(process.env.BENCH_ROWS || '10000', 10);
  const iters = parseInt(process.env.BENCH_ITERS || '2000', 10);
  const providers = (process.env.BENCH_PROVIDERS || 'sqlite').split(',') as ProviderKey[];
  const outPath = process.env.BENCH_OUT || undefined;

  const results: ProviderRunResult[] = [];
  for (const p of providers) {
    const r = await runForProvider(p, rows, iters);
    if (r) results.push(r);
  }

  const suite: SuiteResult = {
    timestamp: Date.now(),
    results,
    config: { providers, rows, iterations: iters, format: fmt }
  };

  outputResult(suite, fmt, outPath);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
