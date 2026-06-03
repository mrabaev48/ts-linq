/**
 * Type-level tests for the public surface of `@ts-linq/metrics-safe`.
 *
 * Run with `tsd` (the package must be built first so its `.d.ts` exists):
 *   `pnpm -F @ts-linq/metrics-safe test-d`
 * or repo-wide via `pnpm test-d`.
 *
 * These are not part of the Jest suite; they are a permanent compile-time
 * regression guard for the package's public signatures. Negative assertions
 * use `tsd`'s `expectError` — no `any`, casts, or suppression comments.
 */
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd';

import {
  MemoryProfiler,
  type MemoryProfilerOptions,
  type MemorySample,
  safeCache,
  safeCacheEvicted,
  safeCacheSize,
  warnIfLoggerDebug,
} from '..';

// The logger is intentionally untyped at the call site (Null-Object pattern).
const logger: unknown = {};

// ── safeCache ───────────────────────────────────────────────────────────────
expectType<void>(safeCache(logger, { cache: 'sqlGen', hit: true }));
expectType<void>(safeCache(logger, { cache: 'entityL2', hit: false, provider: 'pg', ttl: true }));
// `cache` must be one of the known literals.
expectError(safeCache(logger, { cache: 'unknown', hit: true }));
// `hit` is required.
expectError(safeCache(logger, { cache: 'count' }));
// `provider` must be a string when present.
expectError(safeCache(logger, { cache: 'count', hit: true, provider: 123 }));

// ── safeCacheSize ─────────────────────────────────────────────────────────────
expectType<void>(safeCacheSize(logger, { cache: 'count', size: 10 }));
expectType<void>(safeCacheSize(logger, { cache: 'sqlGen', size: 1, provider: 'mysql' }));
// `size` is required and numeric.
expectError(safeCacheSize(logger, { cache: 'count' }));
expectError(safeCacheSize(logger, { cache: 'count', size: 'big' }));

// ── safeCacheEvicted ──────────────────────────────────────────────────────────
expectType<void>(safeCacheEvicted(logger, { cache: 'entityL2' }));
expectType<void>(safeCacheEvicted(logger, { cache: 'entityL2', provider: 'pg' }));
// `cache` is required and constrained to the known literals.
expectError(safeCacheEvicted(logger, {}));
expectError(safeCacheEvicted(logger, { cache: 'nope' }));

// ── warnIfLoggerDebug ─────────────────────────────────────────────────────────
expectType<void>(warnIfLoggerDebug('saveChanges', new Error('boom')));
expectType<void>(warnIfLoggerDebug('detectChanges', 'any unknown reason'));
// `method` must be a string.
expectError(warnIfLoggerDebug(123, new Error('boom')));

// ── MemoryProfiler ────────────────────────────────────────────────────────────
expectType<MemoryProfiler>(new MemoryProfiler());
expectType<MemoryProfiler>(new MemoryProfiler({ enableGC: true, sampleIntervalMs: 1000 }));
// Options are validated: wrong field type and unknown fields are rejected.
expectError(new MemoryProfiler({ enableGC: 'yes' }));
expectError(new MemoryProfiler({ unknownOption: true }));

const profiler = new MemoryProfiler();
// `sample()` resolves a `MemorySample`; `allowGc` is an optional boolean.
expectType<Promise<MemorySample>>(profiler.sample());
expectType<Promise<MemorySample>>(profiler.sample(true));
// `onSample` returns an unsubscribe function and hands a `MemorySample` to the listener.
expectType<() => void>(profiler.onSample((sample) => expectType<MemorySample>(sample)));
// The listener must be a function.
expectError(profiler.onSample(123));

// ── MemorySample shape ────────────────────────────────────────────────────────
expectAssignable<MemorySample>({
  timestampMs: 0,
  rssBytes: 0,
  heapTotalBytes: 0,
  heapUsedBytes: 0,
  externalBytes: 0,
  arrayBuffersBytes: 0,
  heapPressure: 0,
});
// Every field is required.
expectNotAssignable<MemorySample>({ timestampMs: 0 });

// ── MemoryProfilerOptions shape ───────────────────────────────────────────────
expectAssignable<MemoryProfilerOptions>({});
expectAssignable<MemoryProfilerOptions>({
  enableGC: true,
  sampleIntervalMs: 1,
  trackAllocations: false,
  heapDumpThreshold: 0.9,
  heapDumpDir: '/tmp',
  maxSamples: 10,
});
// Wrong field types are rejected.
expectNotAssignable<MemoryProfilerOptions>({ enableGC: 'true' });
