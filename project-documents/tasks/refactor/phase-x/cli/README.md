# Refactor Audit: cli

## Package responsibility

`@ts-linq/cli` is the `ts-linq` command-line tool. It:

1. **Dispatches commands** (`cli.ts`, `CommandRegistry.ts`, `commands/*`) for init, code
   generation, schema export/diff/apply/validate, migration status/dry-run/rollback/
   validate/script/bundle, scaffolding, seeding, `dbcontext optimize`, and metrics serving.
2. **Loads database providers** from env/connection strings (`provider-factory.ts`,
   `adapters/EnvProviderFactory.ts`, `ports/ProviderFactory.ts`).
3. **Generates code** — compiled AOT models (`generators/CompiledModelEmitter.ts`), entity
   and migration templates (`generators/*`).
4. **Introspects schemas** for inspect/scaffold (`schema-inspect.ts`).
5. Provides ports/adapters for filesystem and logging (`ports/*`, `adapters/*`).

Prod deps: `@ts-linq/core`, `@ts-linq/metadata`, `@ts-linq/types`, `@ts-linq/migrations`.
Provider/dialect packages are `optionalDependencies`, loaded via dynamic `import`.

## Current architectural problems

- **Runtime execution of user TypeScript via `require()` (P0).** `dbcontext optimize`,
  `migration:script`, `migration:rollback`, and `migration:validate` `require()` the user's
  TS/JS modules, instantiate the classes, and in some cases *execute* `up()` against a spy
  provider — a documented tech-debt hack (`StubDatabaseProvider`, Proxy spy). Errors are
  silently swallowed in several spots.
- **Two competing provider-construction implementations + secret handling (P0/P1).**
  `provider-factory.ts` (eager if-chain, `as unknown as DatabaseProvider` casts, parses
  connection strings holding credentials) and `ScaffoldCommand.createProvider`
  (a *second* copy of the same parsing) coexist; `EnvProviderFactory` wraps the former but
  most commands call `createProviderFromEnv` directly, so the `ProviderFactory` port is
  largely unused.
- **Inconsistent error handling and exit codes (P1).** Exit code `1` vs `2` is used
  arbitrarily for "not found"; the top-level `main().catch` dumps the raw error object;
  several `catch {}` swallow silently.
- **Hardcoded composition root (P1).** `cli.ts` `new`s all 18 commands inline and reads
  `process.argv`/`process.exit` directly, so dispatch is not unit-testable end-to-end.
- **Dialect/provider SQL leaking into the CLI (P1).** `schema-inspect.ts` contains raw
  per-dialect introspection SQL (duplicating migrations' `SchemaInspector` and the dialect
  introspectors) and has a MSSQL/MySQL bug (`"BASE TABLE"` uses ANSI double quotes).
- **Duplicated arg parsing (P2).** `services/ArgReader.flag` and `utils.getFlag` are
  byte-for-byte the same algorithm; three commands each re-implement `tryRegisterTsNode` +
  module loading.
- **i18n inconsistency (P2).** `MetricsServeCommand` user-facing strings are in Russian
  while the rest of the CLI is English.

## Refactor goals

1. Replace `require()`-based runtime execution with static metadata extraction (TS Compiler
   API / declarative migration descriptors), eliminating `StubDatabaseProvider` and the spy
   Proxy.
2. Unify provider construction behind the existing `ProviderFactory` port; one
   connection-string parser; remove `as unknown as` casts; redact secrets in logs/errors.
3. Standardize a typed CLI error + exit-code contract and a single top-level error handler.
4. Make the composition root injectable/testable.
5. Move schema introspection SQL out of the CLI into migrations/dialect packages.
6. De-duplicate arg parsing and migration-module loading.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Replace require()-based runtime execution / StubDatabaseProvider | P0 | Correctness + security; documented tech debt; silent swallow in core paths |
| 2 | task-2.md — Unify provider construction + secret handling behind ProviderFactory | P0 | Duplicated credential-parsing logic; unsafe casts; unused port |
| 3 | task-3.md — Standardize CLI error model + exit-code contract | P1 | Inconsistent exit codes; raw error dumps; silent catches |
| 4 | task-4.md — Injectable composition root / testable dispatch | P1 | Hardcoded `new` + `process.*`; dispatch untestable |
| 5 | task-5.md — Move schema-introspection SQL out of the CLI (+ fix BASE TABLE bug) | P1 | Provider/dialect logic in CLI; correctness bug; duplication |
| 6 | task-6.md — De-duplicate arg parsing and migration-module loading | P2 | DRY; three copies of ts-node/require loaders; two flag readers |
| 7 | task-7.md — Localize/standardize user-facing strings (MetricsServeCommand) | P3 | i18n inconsistency; polish |

## Dependencies on other packages

- `@ts-linq/core` (`DatabaseProvider`, `startPrometheusServer`), `@ts-linq/metadata`
  (`createMetadataRegistry`, `CompiledModel`), `@ts-linq/types`, `@ts-linq/migrations`
  (snapshot/diff/runner/emitter/scaffold/bundle).
- Provider + dialect packages via dynamic import (optional deps). Task-5 will route
  introspection through the dialect introspectors that already exist.

## Testing strategy

- **Command unit tests** with injected `Logger`/`FileSystem`/`ProviderFactory` fakes
  (the DI seams already exist in most commands).
- **Dispatch tests** over an injectable registry + fake argv/exit, asserting exit codes.
- **Provider-factory tests** covering URL/connection-string parsing per dialect and secret
  redaction in error messages.
- **Contract tests** for the new static model-extraction path (no `require`, no DB).
- **Error-path tests** for every currently-silent `catch`.

## Notes

- LOC ≈ 5.5K. Largest: `CompiledModelEmitter.ts` (278), `provider-factory.ts` (225),
  `MigrationsScriptCommand.ts` (215), `schema-inspect.ts` (185), `DbContextOptimizeCommand.ts`
  (162), `ScaffoldCommand.ts` (150).
- `tests/` and `tests-new/` coexist (two test suites) — note for the testing-cleanup
  effort, out of scope here.
