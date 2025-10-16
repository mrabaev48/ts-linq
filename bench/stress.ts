import { DbContext } from '../packages/core/src/context/DbContext';
import { Entity } from '../packages/core/src/decorators/Entity';
import { Column } from '../packages/core/src/decorators/Column';
import { PrimaryKey } from '../packages/core/src/decorators/PrimaryKey';
import type { DatabaseProvider } from '../packages/core/src/DatabaseProvider';
import { SQLiteProvider } from '../packages/sqlite/src/SQLiteProvider';

@Entity({ name: 'kv' })
class KV {
  @PrimaryKey({ autoIncrement: true })
  id!: number;
  @Column({ type: 'TEXT', nullable: false })
  k!: string;
  @Column({ type: 'TEXT', nullable: false })
  v!: string;
}

class StressCtx extends DbContext {
  public kv = this.set(KV);
}

function nowNs(): bigint {
  return process.hrtime.bigint();
}

function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

async function ensureSchema(ctx: StressCtx): Promise<void> {
  const prov = (ctx as unknown as { provider?: DatabaseProvider }).provider as DatabaseProvider;
  await prov.connect();
  await prov.executeNonQuery('DROP TABLE IF EXISTS kv');
  await prov.executeNonQuery(
    'CREATE TABLE kv (id INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT, v TEXT)'
  );
}

async function randomReadWrite(
  ctx: StressCtx,
  writesPerSec: number,
  readsPerSec: number,
  durationMs: number
): Promise<{ writes: number; reads: number; errors: number }> {
  const endAt = Number(process.hrtime.bigint() / BigInt(1_000_000)) + durationMs;
  let writes = 0;
  let reads = 0;
  let errors = 0;

  async function writer(): Promise<void> {
    const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, writesPerSec)));
    while (Number(process.hrtime.bigint() / BigInt(1_000_000)) < endAt) {
      try {
        const key = 'k_' + Math.floor(Math.random() * 1000000);
        const value = 'v_' + Math.random().toString(36).slice(2);
        const prov = (ctx as unknown as { provider?: DatabaseProvider })
          .provider as DatabaseProvider;
        await prov.executeNonQuery('INSERT INTO kv(k, v) VALUES(?, ?)', [key, value]);
        writes++;
      } catch {
        errors++;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async function reader(): Promise<void> {
    const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, readsPerSec)));
    while (Number(process.hrtime.bigint() / BigInt(1_000_000)) < endAt) {
      try {
        const page = Math.floor(Math.random() * 100);
        await ctx.kv
          .orderBy((x) => x.id)
          .skip(page * 10)
          .take(10)
          .toArray();
        reads++;
      } catch {
        errors++;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  const writers = parseInt(process.env.STRESS_WRITERS || '4', 10);
  const readers = parseInt(process.env.STRESS_READERS || '8', 10);
  await Promise.all(
    [...Array(writers)].map(() => writer()).concat([...Array(readers)].map(() => reader()))
  );
  return { writes, reads, errors };
}

async function main(): Promise<void> {
  const durationMs = parseInt(process.env.STRESS_DURATION_MS || '15000', 10);
  const writesPerSec = parseInt(process.env.STRESS_WPS || '100', 10);
  const readsPerSec = parseInt(process.env.STRESS_RPS || '200', 10);

  const provider = new SQLiteProvider(':memory:');
  const ctx = new StressCtx({ provider });
  await ensureSchema(ctx);

  const t1 = nowNs();
  const { writes, reads, errors } = await randomReadWrite(
    ctx,
    writesPerSec,
    readsPerSec,
    durationMs
  );
  const t2 = nowNs();

  const elapsedMs = nsToMs(t2 - t1);
  const summary = {
    durationMs,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    writes,
    reads,
    errors,
    writesPerSec: Math.round((writes / (elapsedMs / 1000)) * 100) / 100,
    readsPerSec: Math.round((reads / (elapsedMs / 1000)) * 100) / 100
  } as const;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary));

  await (ctx as unknown as { dispose: () => Promise<void> }).dispose?.();
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
