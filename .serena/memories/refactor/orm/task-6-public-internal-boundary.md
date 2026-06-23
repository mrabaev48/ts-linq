## refactor orm/task-6 — public/internal API boundary (✅ DONE)

orm's 6TH task. Branch `audit-refactor/orm-public-internal-boundary`. **Breaking → orm major 5.1.0→6.0.0.**

### What changed
- **Curated `"."` barrel** (`packages/orm/src/index.ts`): removed implementation-only re-exports.
  Moved to `src/internal/index.ts`: `batch-executor` (`BatchExecutor`), `batch-grouper`
  (`groupChanges`/`chunkGroup`), `IdentityMap`, `interceptors/InterceptorRegistry`,
  `changetracker/CascadeWalker`, `changetracker/JsonSnapshotter`,
  `database/has-pending-model-changes` (`PendingModelChangesChecker`), and the 4 value-generator
  **classes** (`HiLo/Ulid/UtcNow/UuidV7ValueGenerator`). **`FetchNextHiLoBlock` type stays public.**
  `internal/index.ts` already held 4 services (Audit/SoftDelete interceptors, CacheCoordinator,
  ChangeValidationService) — appended to those.
- **`package.json` exports**: added `"./internal"` → require `dist/internal/index.js`, import
  `dist/esm/internal/index.js`, types `dist/internal/index.d.ts` (mirrors query's `./internal`).
- **jest-config** (`packages/jest-config/index.js`, excluded from changesets): added
  `@ts-linq/orm/internal`→`packages/orm/src/internal` in `tsLinqTsJestConfig.paths`,
  `tsLinqModuleNameMapper` (BEFORE `^@ts-linq/orm$`), and `createPackageJestConfig` (BEFORE generic
  `^@ts-linq/(.*)$`).
- **CI gate**: new `tests-new/OrmPublicBarrel.test.ts` (explicit allowlist of **42** runtime value
  exports incl `CoreEventId`/`RelationalEventId`/`QuerySplittingBehavior`; asserts 12 moved symbols
  absent from `"."` + present in `/internal`) + `tests-new/OrmInternalSubpath.test.ts` (imports via
  the `@ts-linq/orm/internal` specifier to exercise resolution).

### KEY DECISIONS (user-confirmed)
- **query/internal alias NOT changed — kept `../query/dist/internal`.** Reasons: (1) `moduleResolution:
  node` (classic node10) does NOT read package.json `exports`, so removing the alias breaks tsc;
  (2) retargeting `dist→src` BREAKS orm's composite ESM emit (`tsc` pulls `query/src/internal/*.ts`
  outside orm's `rootDir` → TS6059/6307; CJS survives via project-ref redirect, ESM doesn't);
  (3) emitting-lib precedent: query itself uses `../sql-visitor/dist/internal` for the same reason
  (jest/e2e/integration use `src` only because they're non-emit); (4) **orm also imports the
  intentionally-internal `QueryContext`/`QueryContextProps` from query/internal — so the alias is
  unremovable regardless**; relocating only the cache classes would re-widen query's public API
  (regress query/task-10) for zero alias removal. dependency-cruiser's
  `no-query-internal-from-non-collaborators` explicitly whitelists orm → sanctioned channel.
  task-6 scoped to orm's OWN boundary; query coupling documented as already-consistent (tech-debt).
- **No downstream consumer migration needed**: zero external packages import the moved symbols from
  `@ts-linq/orm`; orm's own tests use relative `../src/...` imports.

### GOTCHA
- Local env had **180 untracked stray compiled artifacts in `packages/query/src/`** (`.js`/`.d.ts`/
  maps) that made ts-jest resolve `.js` before `.ts` → "Unexpected token 'export'" when importing
  the query barrel. Cleaned with `git ls-files --others --exclude-standard 'packages/query/src/**' |
  grep '\.(js|d\.ts|...)$' | xargs rm`. CI is clean (fresh checkout); this was local pollution.
- Single-file `npx jest <path>` uses root `jest.config.js`; full unit run is `jest -c jest.unit.config.js`.

### Validation (all green)
typecheck 32/32, lint 0 err, test:unit 3756/3756 (377 suites), test:integration 461 pass/2 skip,
test:e2e 290, build 32/32, arch:deps clean, arch:cycles none, arch:dead clean (no orm leak),
test-d 35/35.

**orm stays 🔄 In Progress; tasks 7,8 pending. next orm = task-7 (split EntityTypeBuilder).**
