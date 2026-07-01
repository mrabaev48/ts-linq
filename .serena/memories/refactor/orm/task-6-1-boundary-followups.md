# orm/task-6.1 — boundary follow-ups (✅ DONE)

Follow-up to `refactor/orm/task-6-public-internal-boundary`. Closed all six documented tech-debt
items. Branch `audit-refactor/orm-boundary-followups` stacked on the (unmerged) task-6 branch.

## Item 1 (primary) — query coupling DECOUPLED via public seam (option b)
- Rejected: (a) accept alias as sanctioned channel; (b1) promote raw QueryContext to query public
  barrel (would regress query/task-10 curation); (b2) new neutral package (infeasible — QueryContext
  transitively needs internal SqlVisitorFactory, EnhancedSqlCache needs Lru/Ttl/Metrics stack).
- Chosen: **public boundary seam** `packages/query/src/QueryableFactory.ts` (re-exported from query
  `src/index.ts`):
  - `createQueryable(entityClass, props: QueryableSeedProps)` — hides internal `QueryContext`.
  - `createRawSqlQueryable(entityClass, provider, entityLoader, sql, params)` — hides QueryContext +
    `Queryable._withRawSqlSource`.
  - `createDefaultSqlCache(): OwnedSqlCache` (new public `OwnedSqlCache extends SqlCache { dispose();
    getMetrics?() }`) and `createDefaultCountCache(): CountCache`.
  - New public `QueryableSeedProps` = QueryContextProps minus internal `visitorFactory`;
    `QueryContextProps extends QueryableSeedProps` now (single source of truth). QueryContext stays
    `@internal`.
- orm repointed 4 source files to `@ts-linq/query`: context/QueryableFactory.ts (delegates),
  context/DbContextBootstrapper.ts (cache factories), DbContext.ts + context/DbContextServices.ts
  (type EnhancedSqlCache → OwnedSqlCache).
- Removed `paths["@ts-linq/query/internal"]` from packages/orm/tsconfig.json (esm tsconfig inherits).
- Tightened .dependency-cruiser.cjs `no-query-internal-from-non-collaborators` → only
  integration-tests whitelisted (orm dropped). arch:deps green (orm ⊄ packages/query/src/internal).

## Items 2–6
- 2: FetchNextHiLoBlock kept public + per-symbol `@public` TSDoc.
- 3: per-symbol `@public`/`@internal` TSDoc on advanced barrel exports (orm src/index.ts +
  src/internal/index.ts).
- 4: OrmPublicBarrel.test.ts = single authoritative gate (documented in header + orm/CLAUDE.md);
  ts-prune deliberately NOT duplicating.
- 5: packages/orm/scripts/smoke-internal-resolution.cjs (npm `smoke:internal`): HARD static gate on
  exports["./internal"] require/import/types + artifact presence; runtime require()+import()
  best-effort. Both blocked by PRE-EXISTING repo-wide hazard — ESM-only leaf pkgs (esp. @ts-linq/ast:
  main/module/exports all → dist/esm) emit extension-less relative imports → Node ESM
  ERR_MODULE_NOT_FOUND; transitive, breaks even require('@ts-linq/orm') public entry. Recorded, exit 0.
- 6: root .gitignore ignores *.js/*.js.map/*.d.ts/*.d.ts.map under packages/*/src/** (negates the one
  real hand-written source packages/e2e-tests/src/jest-transformer.js). Prevents stray tsc output →
  phantom ts-jest SyntaxError.

## Changeset / validations
- query **minor 4.2.0**, orm **patch 6.0.1**.
- Green: typecheck, lint(0 err), test:unit 3756, test:integration 461, test:e2e 290, build,
  arch:deps/cycles/dead, smoke:internal static gate. `pnpm test:all` wrapper shows a pre-existing
  worker-teardown flake (2 suites force-killed, 0 real test failures); each gate green run separately.
- orm public surface byte-unchanged. orm stays In Progress; **next orm = task-7** (split
  EntityTypeBuilder).
