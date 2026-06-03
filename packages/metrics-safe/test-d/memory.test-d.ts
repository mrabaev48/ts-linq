/**
 * Type-level tests for the `@ts-linq/metrics-safe/memory` subpath entrypoint.
 *
 * These assert that the dedicated subpath added in the MemoryProfiler boundary
 * refactor resolves the expected public symbols through the package `exports`
 * map (run via `tsd`; the package must be built first so its `.d.ts` exists).
 * The same symbols stay re-exported from the root barrel (see `index.test-d.ts`)
 * for backward compatibility — this file guards that the subpath is wired and
 * exposes the identical surface.
 */
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd';

import {
  MemoryProfiler,
  type MemoryProfilerOptions,
  type MemorySample,
} from '@ts-linq/metrics-safe/memory';

// ── MemoryProfiler resolves from the subpath ─────────────────────────────────
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

// ── MemorySample shape resolves from the subpath ─────────────────────────────
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

// ── MemoryProfilerOptions shape resolves from the subpath ─────────────────────
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
