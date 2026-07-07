// The `DdlStrategy` contract now lives in `@ts-linq/types` (the foundation package) so migrations,
// scaffolding, providers, and the dialects all depend on a single shared abstraction rather than on
// concrete dialect classes. Re-exported here for backward compatibility with existing
// `@ts-linq/core` consumers (e.g. `DdlBuilder`).
export type { CreateIndexSpec, DdlStrategy, ForeignKeySpec, TypeMapper } from '@ts-linq/types';
