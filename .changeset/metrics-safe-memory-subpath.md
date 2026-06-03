---
'@ts-linq/metrics-safe': minor
---

feat(metrics-safe): expose MemoryProfiler on a dedicated `./memory` subpath

`MemoryProfiler` (the Node-coupled process/heap memory sampler) is now available
on its own entrypoint, `@ts-linq/metrics-safe/memory`, separating it from the
lightweight safe-invoke helpers on the package root and improving package
cohesion (SRP at package granularity).

Backward compatible: `MemoryProfiler`, `MemorySample`, and `MemoryProfilerOptions`
remain re-exported from the root `@ts-linq/metrics-safe`, so existing imports keep
working unchanged. New code can prefer the `/memory` subpath.

Refactor task-3 (Option A). Full extraction into a standalone
`@ts-linq/memory-profiler` package (Option B) is deferred to a future broader
observability reorganization.
