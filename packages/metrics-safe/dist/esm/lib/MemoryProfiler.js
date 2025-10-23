/*
 * Lightweight memory profiler with safe Node integrations.
 * - Periodically samples process memory and (optionally) v8 heap stats
 * - Optional GC hint before sampling (if --expose-gc enabled)
 * - Optional heap snapshot via inspector (best-effort)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
export class MemoryProfiler {
    constructor(options) {
        this.timer = null;
        this.samples = [];
        this.listeners = new Set();
        this.aliveAllocations = 0;
        this.options = {
            enableGC: options?.enableGC ?? false,
            sampleIntervalMs: options?.sampleIntervalMs ?? 10000,
            trackAllocations: options?.trackAllocations ?? false,
            heapDumpThreshold: options?.heapDumpThreshold,
            heapDumpDir: options?.heapDumpDir,
            maxSamples: options?.maxSamples ?? 1024
        };
        if (this.options.trackAllocations && typeof FinalizationRegistry !== 'undefined') {
            this.allocationRegistry = new FinalizationRegistry(() => {
                if (this.aliveAllocations > 0)
                    this.aliveAllocations -= 1;
            });
        }
    }
    start() {
        if (this.timer)
            return;
        if (this.options.sampleIntervalMs > 0) {
            this.timer = setInterval(() => {
                void this.sample(true);
            }, this.options.sampleIntervalMs);
            // Prevent keeping the event loop alive
            if (typeof this.timer.unref === 'function')
                this.timer.unref();
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    onSample(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    getSamples() {
        return this.samples;
    }
    getAliveAllocations() {
        return this.aliveAllocations;
    }
    /** Register an allocation for tracking (no-op if trackAllocations=false). */
    trackAllocation(obj) {
        if (this.allocationRegistry && obj && typeof obj === 'object') {
            this.aliveAllocations += 1;
            try {
                this.allocationRegistry.register(obj, undefined);
            }
            catch {
                // ignore if object is not eligible
            }
        }
        return obj;
    }
    /** Take a memory sample. If allowGc=true and enableGC, runs global.gc() when available. */
    async sample(allowGc = false) {
        if (allowGc && this.options.enableGC) {
            try {
                const maybeGc = global.gc;
                maybeGc?.();
            }
            catch {
                // ignore
            }
        }
        const mem = safeMemoryUsage();
        const sample = {
            timestampMs: Date.now(),
            rssBytes: mem.rss,
            heapTotalBytes: mem.heapTotal,
            heapUsedBytes: mem.heapUsed,
            externalBytes: mem.external,
            arrayBuffersBytes: mem.arrayBuffers ?? 0,
            heapPressure: mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0
        };
        this.pushSample(sample);
        if (this.options.heapDumpThreshold !== undefined &&
            sample.heapPressure >= this.options.heapDumpThreshold) {
            try {
                // fire-and-forget; avoid blocking sample path
                void this.takeHeapSnapshot().catch(() => undefined);
            }
            catch {
                // ignore
            }
        }
        for (const l of this.listeners) {
            try {
                l(sample);
            }
            catch {
                // listener errors are ignored
            }
        }
        return sample;
    }
    pushSample(sample) {
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
    async takeHeapSnapshot(outPath) {
        // Dynamic import to avoid hard dependency
        let inspector = null;
        try {
            // eslint-disable-next-line @typescript-eslint/consistent-type-imports
            inspector = await import('node:inspector');
        }
        catch {
            return null;
        }
        const session = new inspector.Session();
        try {
            session.connect();
        }
        catch {
            return null;
        }
        const chunks = [];
        session.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
            chunks.push(m.chunk);
        });
        await new Promise((resolve, reject) => {
            session.post('HeapProfiler.takeHeapSnapshot', { reportProgress: false }, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        session.disconnect();
        const dir = this.options.heapDumpDir ?? process.cwd();
        const filePath = outPath ??
            path.join(dir, `heap-${new Date().toISOString().replace(/[:.]/g, '-')}.heapsnapshot`);
        try {
            fs.writeFileSync(filePath, chunks.join(''));
            return filePath;
        }
        catch {
            return null;
        }
    }
}
function safeMemoryUsage() {
    try {
        return process.memoryUsage();
    }
    catch {
        return {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
            arrayBuffers: 0
        };
    }
}
//# sourceMappingURL=MemoryProfiler.js.map