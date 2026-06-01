# @ts-linq/cli

## 1.1.1

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/migrations@2.2.0

## 1.1.0

### Minor Changes

- f177bb9: feat(migrations): add migration bundles, idempotent scripts, and HasPendingModelChanges (P2-42)
  - `@ts-linq/migrations`: new `IdempotentEmitter` that wraps each migration in a per-dialect guard block (PostgreSQL DO $$, MSSQL IF NOT EXISTS, MySQL stored procedure); new `MigrationBundleBuilder` using esbuild to produce self-contained Node.js bundle scripts; new `ModelSnapshotBuilder` / `ModelSnapshotSerializer` for deterministic model-state JSON; new `ModelSnapshotDiff` for structural change detection between two snapshots
  - `@ts-linq/orm`: `DatabaseFacade` gains `hasPendingModelChanges()` (synchronous), `getPendingMigrations()`, and `migrate({ idempotent? })` mirroring EF Core's `HasPendingModelChanges`, `GetPendingMigrationsAsync`, and `MigrateAsync`; `DbContextOptionsBuilder` gains `.migrations({ directory })` fluent method; `DbContextOptions` gains `migrationsDirectory` field
  - `@ts-linq/cli`: new `migration:script` command (`--idempotent`, `--output`); new `migration:bundle` command (`--target`, `--output`)

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [e4c55db]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [f177bb9]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/migrations@2.1.0
  - @ts-linq/core@1.4.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/core@1.3.0
  - @ts-linq/types@2.2.0
  - @ts-linq/migrations@2.0.2

## 1.0.2

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/types@2.1.0
  - @ts-linq/migrations@2.0.1

## 1.0.1

### Patch Changes

- [#92](https://github.com/mrabaev48/ts-linq/pull/92) [`75fb19b`](https://github.com/mrabaev48/ts-linq/commit/75fb19b6f9b4952f6ddebfc0187c0b871e6fc871) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add publishConfig to ensure scoped packages publish with public access on npm

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/migrations@2.0.0
