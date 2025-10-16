/*
 * Lightweight memory profiler with safe Node integrations.
 * - Periodically samples process memory and (optionally) v8 heap stats
 * - Optional GC hint before sampling (if --expose-gc enabled)
 * - Optional heap snapshot via inspector (best-effort)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MemorySample {
  timestampMs: number;
  rssBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  /** Ratio heapUsed/heapTotal in [0..1], or 0 if heapTotal is 0 */
  heapPressure: number;
}

export interface MemoryProfilerOptions {
  /** When true, attempts to run global.gc() before sampling (requires --expose-gc). Default: false. */
  enableGC?: boolean;
  /** Collect samples every N ms. Disable if <= 0. Default: 10000 (10s). */
  sampleIntervalMs?: number;
  /** If true, exposes tracking helpers for allocations (FinalizationRegistry based). Default: false. */
  trackAllocations?: boolean;
  /** Trigger heap snapshot when heapPressure exceeds this threshold (0..1). Default: undefined (disabled). */
  heapDumpThreshold?: number;
  /** Directory to save heap snapshots when triggered. Default: process.cwd(). */
  heapDumpDir?: string;
  /** Optional cap for samples stored in memory. Default: 1024. */
  maxSamples?: number;
}

type SampleListener = (sample: MemorySample) => void;

export class MemoryProfiler {
  private readonly options: Required<
    Omit<MemoryProfilerOptions, 'heapDumpThreshold' | 'heapDumpDir'>
  > & {
    heapDumpThreshold?: number;
    heapDumpDir?: string;
  };
  private timer: NodeJS.Timeout | null = null;
  private samples: MemorySample[] = [];
  private readonly listeners: Set<SampleListener> = new Set();
  private readonly allocationRegistry?: FinalizationRegistry<undefined>;
  private aliveAllocations: number = 0;

  constructor(options?: MemoryProfilerOptions) {
    this.options = {
      enableGC: options?.enableGC ?? false,
      sampleIntervalMs: options?.sampleIntervalMs ?? 10_000,
      trackAllocations: options?.trackAllocations ?? false,
      heapDumpThreshold: options?.heapDumpThreshold,
      heapDumpDir: options?.heapDumpDir,
      maxSamples: options?.maxSamples ?? 1024
    };

    if (this.options.trackAllocations && typeof FinalizationRegistry !== 'undefined') {
      this.allocationRegistry = new FinalizationRegistry(() => {
        if (this.aliveAllocations > 0) this.aliveAllocations -= 1;
      });
    }
  }

  public start(): void {
    if (this.timer) return;
    if (this.options.sampleIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.sample(true);
      }, this.options.sampleIntervalMs);
      // Prevent keeping the event loop alive
      if (typeof this.timer.unref === 'function') this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public onSample(listener: SampleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getSamples(): ReadonlyArray<MemorySample> {
    return this.samples;
  }

  public getAliveAllocations(): number {
    return this.aliveAllocations;
  }

  /** Register an allocation for tracking (no-op if trackAllocations=false). */
  public trackAllocation<T extends object>(obj: T): T {
    if (this.allocationRegistry && obj && typeof obj === 'object') {
      this.aliveAllocations += 1;
      try {
        this.allocationRegistry.register(obj, undefined);
      } catch {
        // ignore if object is not eligible
      }
    }
    return obj;
  }

  /** Take a memory sample. If allowGc=true and enableGC, runs global.gc() when available. */
  public async sample(allowGc: boolean = false): Promise<MemorySample> {
    if (allowGc && this.options.enableGC) {
      try {
        const maybeGc = (global as unknown as { gc?: () => void }).gc;
        maybeGc?.();
      } catch {
        // ignore
      }
    }

    const mem = safeMemoryUsage();
    const sample: MemorySample = {
      timestampMs: Date.now(),
      rssBytes: mem.rss,
      heapTotalBytes: mem.heapTotal,
      heapUsedBytes: mem.heapUsed,
      externalBytes: mem.external,
      arrayBuffersBytes: mem.arrayBuffers ?? 0,
      heapPressure: mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0
    };

    this.pushSample(sample);

    if (
      this.options.heapDumpThreshold !== undefined &&
      sample.heapPressure >= this.options.heapDumpThreshold
    ) {
      try {
        // fire-and-forget; avoid blocking sample path
        void this.takeHeapSnapshot().catch(() => undefined);
      } catch {
        // ignore
      }
    }

    for (const l of this.listeners) {
      try {
        l(sample);
      } catch {
        // listener errors are ignored
      }
    }

    return sample;
  }

  private pushSample(sample: MemorySample): void {
    this.samples.push(sample);
    if (this.samples.length > this.options.maxSamples) {
      const drop = this.samples.length - this.options.maxSamples;
      this.samples.splice(0, drop);
    }
  }

  /**
   * Take a heap snapshot using the inspector protocol (if available).
   * Returns the written file path, or null if not supported.
   */
  public async takeHeapSnapshot(outPath?: string): Promise<string | null> {
    // Dynamic import to avoid hard dependency
    let inspector: typeof import('node:inspector') | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      inspector = await import('node:inspector');
    } catch {
      return null;
    }

    const session = new inspector.Session();
    try {
      session.connect();
    } catch {
      return null;
    }

    const chunks: string[] = [];
    session.on('HeapProfiler.addHeapSnapshotChunk', (m: { chunk: string }) => {
      chunks.push(m.chunk);
    });

    await new Promise<void>((resolve, reject) => {
      session.post('HeapProfiler.takeHeapSnapshot', { reportProgress: false }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    session.disconnect();

    const dir = this.options.heapDumpDir ?? process.cwd();
    const filePath =
      outPath ??
      path.join(dir, `heap-${new Date().toISOString().replace(/[:.]/g, '-')}.heapsnapshot`);
    try {
      fs.writeFileSync(filePath, chunks.join(''));
      return filePath;
    } catch {
      return null;
    }
  }
}

function safeMemoryUsage(): NodeJS.MemoryUsage & { arrayBuffers?: number } {
  try {
    return process.memoryUsage();
  } catch {
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    } as NodeJS.MemoryUsage & { arrayBuffers?: number };
  }
}
