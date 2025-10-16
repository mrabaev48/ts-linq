import { AppDbContext } from '../packages/core/src/context/DbContext';
import { MemoryProfiler } from '../packages/metrics-safe/src/lib/MemoryProfiler';
import { PrometheusSqlLogger } from '../packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger';

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const profiler = new MemoryProfiler({
    enableGC: true,
    sampleIntervalMs: 1000,
    trackAllocations: true
  });
  profiler.start();

  // Optional: wire Prometheus logger to publish memory gauges on samples
  const prom = new PrometheusSqlLogger('bench', { memory: { profiler } });

  const ctx = new AppDbContext({ provider: 'sqlite', connectionString: ':memory:', logger: prom });

  // Simple workload to allocate memory
  const garbage: unknown[] = [];
  for (let i = 0; i < 50; i++) {
    garbage.push(Buffer.alloc(1024 * 1024)); // 1 MB
    await sleep(50);
  }

  // Emit one manual sample at the end
  await profiler.sample(true);

  // Print last sample to stdout
  const last = profiler.getSamples()[profiler.getSamples().length - 1];
  if (last) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        rssMB: Math.round((last.rssBytes / (1024 * 1024)) * 100) / 100,
        heapUsedMB: Math.round((last.heapUsedBytes / (1024 * 1024)) * 100) / 100,
        heapPressure: Math.round(last.heapPressure * 1000) / 1000
      })
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
