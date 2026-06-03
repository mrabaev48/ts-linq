/**
 * Public subpath entrypoint: `@ts-linq/metrics-safe/memory`.
 *
 * Exposes the Node-coupled `MemoryProfiler` (process/heap memory sampling with
 * heap-snapshot support) on its own entrypoint so the lightweight safe-invoke
 * helpers on the root (`@ts-linq/metrics-safe`) stay free of the memory-profiler
 * surface. The same symbols remain re-exported from the root barrel for
 * backward compatibility.
 *
 * This thin barrel decouples the public subpath from the internal `lib/` layout.
 */
export * from './lib/MemoryProfiler';
