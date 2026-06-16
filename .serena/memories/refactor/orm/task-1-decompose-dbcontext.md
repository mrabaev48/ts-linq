## refactor orm/task-1: Decompose DbContext god class — ✅ DONE

**Status:** completed. orm's FIRST refactor task; keystone P0/XL/high-risk at the top of the runtime layer.

### What changed
`DbContext.ts` (1104 LOC god class) → thin facade-orchestrator. **Public method signatures byte-identical** (verified via `test-d/index.test-d.ts`); internal decomposition only. Final `DbContext.ts`: 578 total LOC / **341 code-only LOC** (JSDoc on the public surface preserved per user decision → <350 reframed as code-only, like query/task-1).

### New collaborators (all in `packages/orm/src/context/`, NOT barrel-exported → internal)
- **`DbContextServices`** (interface) — immutable value object holding all built collaborators + resolved options.
- **`DbContextBootstrapper`** — `static bootstrap(options, onModelCreating)` → `DbContextServices`. Owns full ctor wiring + cache/performance defaulting (old ctor lines 105–242). Provider side effects (configureSoftDelete/attachLogger/configureInterceptors/configureQueryAnalysis/memoryProfiler.start) preserved byte-for-byte. Forward-ref closures (insert/update/deleteCmd → cacheCoordinator, deleteCmd → softDeleteInterceptor) capture the building `services` object.
- **`ValueGenerationService`** — `prefillHiLoIds`/`prefillDefaults` + `_hiLoGenerators` cache.
- **`ChangeExecutor`** — `executeChanges` (batch/SP/per-row routing), `applySkipNavigationChanges`, private `processChange`/`apply*`/`normalizeChange`.
- **`TransactionScope`** — depth counter + begin/commit/rollback (+ commit/rollback cache-invalidation via safeCacheSize). `isActive`/`reset()`. Public `DbContext.begin/commit/rollbackTransaction`/`isInTransaction`/`reset()` delegate.
- **`DbSetRegistry`** — `set`/`defineSet`/`initialize(target)`/`buildDbSetContext` + `_dbSets`/`_decoratedDbSets`. `initialize(this)` defines auto-generated DbSet properties on the context instance.
- **`save-pipeline/`** — `SaveChangesPipeline.run()` over ordered `SaveStep[]` (DetectChanges→PrefillIds→PrefillDefaults→Validate→BuildEventData→SavingInterceptors→TransactionalExecution) on a mutable `SaveContext` VO; `ctx.done` short-circuits (empty set / suppression). `TransactionalExecutionStep` reproduces the original try/catch byte-for-byte incl. OptimisticConcurrencyError→DbUpdateConcurrencyException translation.
- **`entityOriginal.ts`** — shared `getOriginal()` (used by registry + `ensureCreated`).

### DbContext facade internals
Keeps `_services` + mutable facade state (`_defaultLoadingStrategy`, `_database`, `_returnToPool`) + the 5 collaborators. Read-only access to services-backed values via **private getters** (`get _provider()` etc.) so the remaining facade methods (ensureCreated/entry/find/findAll/include/isLoaded/cache/dispose/getters) were untouched. Dead private `getPrimaryKey` removed.

### Key invariants preserved
- `onModelCreating` runs inside `bootstrap` (faithful: integration tests confirm overrides use only the passed `mb` + statics, never `this` collaborators — instance fields aren't ready during super()).
- saveChanges own-transaction uses RAW `provider.beginTransaction()` when `!scope.isActive` (not depth-managed); pipeline's `TransactionalExecutionStep` mirrors this.
- `throw new Error('DbSet ... not configured')` kept verbatim (task-5 reclassifies).
- Empty `catch (e)` swallows in TransactionScope kept verbatim (task-2 reclassifies).

### Tests
- NEW `tests-new/DbContextSaveChanges.characterization.test.ts` (8 tests, written FIRST): provider call order begin/insert/update/delete/commit/rollback via jest.spyOn on TestProvider, affected-row counts, caller-managed-tx, suppress, error→rollback, **OptimisticConcurrencyError→DbUpdateConcurrencyException (new guard — old concurrency test only covered the exception class, not the saveChanges translation path)**.
- NEW `tests-new/SaveChangesPipeline.test.ts` (5 tests): step ordering + short-circuit with mocked deps.
- **Integration fix:** `integration-tests/.../07-advanced-features/pooling.test.ts` "transaction depth is reset after return" poked private `_transactionDepth` (now moved into TransactionScope) → rewrote to drive depth via public `beginTransaction()` ×2 and assert `recycled.isInTransaction === false` (stronger behavioral assertion). Only existing-test change needed.

### Validation (all green)
typecheck, lint (0 errors; 226 pre-existing `any` warnings in TestProvider unchanged), unit 3642, integration 461, e2e 290, build, arch:deps (no violations)/cycles (none)/dead (no new flags), test-d.

### Versioning / changeset
`@ts-linq/orm` **patch** 4.1.12 → **4.1.13** (internal restructure, public API stable, collaborators internal).

### Feeds / follow-ups
- task-2 (silent/commented catch reclassification — TransactionScope/dispose/cache.* swallows now isolated in their collaborators).
- task-4 (ChangeTracker split feeds the pipeline's SaveSteps).
- task-5 (typed errors — DbSetRegistry's bare Error + the concurrency-translation step).
orm package stays 🔄 In Progress; next orm task = task-2.
