import 'reflect-metadata';

// Global test setup
const perfEnabled = process.env.PERF_GUARD_MS ? Number(process.env.PERF_GUARD_MS) : 0;
const perfDurations: number[] = [];

beforeEach(() => {
  // Clear any existing metadata before each test
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const MetadataStorage = require('../src/metadata/MetadataStorage').MetadataStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  MetadataStorage.getInstance().clear();
  // record test start
  (global as unknown as { __testStart?: number }).__testStart = Date.now();
});

beforeAll(async () => {
  try {
    const mod = await import('./db/setup-containers');
    await mod.startDbContainers();
  } catch {
    // ignore if testcontainers not installed or RUN_DB_TESTS != 1
  }
});

afterAll(async () => {
  try {
    const mod = await import('./db/setup-containers');
    await mod.stopDbContainers();
  } catch {
    // ignore
  }
});

afterEach(() => {
  if (!perfEnabled) return;
  try {
    const start = (global as unknown as { __testStart?: number }).__testStart || Date.now();
    const dur = Date.now() - start;
    const state = expect.getState();
    const testPath: string | undefined = (state as unknown as { testPath?: string }).testPath;
    if (process.env.RUN_DB_TESTS === '1' && testPath && testPath.includes('/tests/db/')) {
      perfDurations.push(dur);
    }
  } catch {
    // ignore
  }
});

afterAll(() => {
  if (!perfEnabled) return;
  if (perfDurations.length === 0) return;
  const sorted = [...perfDurations].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[idx];
  if (p95 > perfEnabled) {
    // Fail the run if p95 exceeds threshold
    throw new Error(`Performance p95 exceeded: ${p95}ms > ${perfEnabled}ms over ${sorted.length} DB tests`);
  }
});
