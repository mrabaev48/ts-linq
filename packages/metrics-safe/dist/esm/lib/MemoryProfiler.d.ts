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
export declare class MemoryProfiler {
    private readonly options;
    private timer;
    private samples;
    private readonly listeners;
    private readonly allocationRegistry?;
    private aliveAllocations;
    constructor(options?: MemoryProfilerOptions);
    start(): void;
    stop(): void;
    onSample(listener: SampleListener): () => void;
    getSamples(): ReadonlyArray<MemorySample>;
    getAliveAllocations(): number;
    /** Register an allocation for tracking (no-op if trackAllocations=false). */
    trackAllocation<T extends object>(obj: T): T;
    /** Take a memory sample. If allowGc=true and enableGC, runs global.gc() when available. */
    sample(allowGc?: boolean): Promise<MemorySample>;
    private pushSample;
    /**
     * Take a heap snapshot using the inspector protocol (if available).
     * Returns the written file path, or null if not supported.
     */
    takeHeapSnapshot(outPath?: string): Promise<string | null>;
}
export {};
//# sourceMappingURL=MemoryProfiler.d.ts.map