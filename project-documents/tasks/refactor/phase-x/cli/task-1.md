---
status: not-started
phase: phase-x
package: cli
priority: P0
effort: XL
risk: critical
category: architecture
depends_on: []
related: ["cli/task-6.md"]
---

# Refactor: Replace require()-based runtime execution and StubDatabaseProvider

## Problem

Four commands extract model/migration information by `require()`-ing the user's source at
runtime, instantiating their classes, and in two cases *executing* migration `up()` against
a fake provider to scrape SQL. This is a documented tech-debt hack. It is fragile (depends
on `ts-node`, module side effects, constructor success), insecure (executes arbitrary user
code, including any side effects in module top-level or `up()`), and swallows failures
silently so a broken extraction looks like "no migrations / no entities".

## Evidence

- `packages/cli/src/commands/DbContextOptimizeCommand.ts:56` — `require(resolvedContext)`
  loads the user DbContext module; `:79-94` instantiates it against
  `StubDatabaseProvider` and **swallows** any constructor error
  (`catch (err) { /* Ignore … */ }`) only logging if `TS_LINQ_OPTIMIZE_DEBUG` is set.
- `packages/cli/src/bootstrap/StubDatabaseProvider.ts:37-132` — an entire fake provider
  whose every method throws, existing solely to let the constructor run.
- `packages/cli/src/commands/MigrationsScriptCommand.ts:146` — `require(filePath)` per
  migration; `:157-171` instantiates and **executes `await instance.up()`** against a Proxy
  "spy" provider to scrape `executeNonQuery` SQL; `:147` and `:168` are bare `catch {}` that
  swallow all load/exec errors → an unparseable migration silently yields `[]`.
- `packages/cli/src/commands/MigrationsScriptCommand.ts:176-188` — `createSpyProvider`
  builds a `Proxy` over the real provider, overriding `executeNonQuery` to collect SQL
  (runtime-execution side-channel).
- `packages/cli/src/commands/MigrationsRollbackCommand.ts:67-74` — `require(file)` +
  `tryRegisterTsNode`; `:92` swallows non-constructible exports.
- `packages/cli/src/commands/MigrationsValidateCommand.ts:90,108` — `require('ts-node/...')`
  + `require(p.abs)` and instantiation to validate exports.

## Why this is bad

- **Arbitrary code execution:** `require` runs module-level side effects; `migration:script`
  additionally runs `up()`. A migration with real side effects (HTTP calls, file writes)
  executes during what the user believes is a read-only "script generation".
- **Silent, undiagnosable failure:** bare `catch {}` turns load/transpile/exec errors into
  empty output; users get wrong scripts/snapshots with no signal.
- **Fragility:** depends on `ts-node` being installed, on the *first* export being the
  migration, on constructor not needing a real provider.
- **Untestable:** requires a real filesystem + transpiler to exercise.

## Target architecture

Apply **Clean Architecture** (keep I/O and "interpretation of source" at a boundary, behind
an abstraction) and prefer **static analysis over runtime execution**.

- Introduce a `ModelSource` port: `extractEntities(contextPath): EntityDescriptor[]` and a
  `MigrationSource` port: `listMigrations(dir): MigrationDescriptor[]` where a descriptor
  carries `{ version, name, upSql() | upStatements }` derived **without executing user
  code**.
- Preferred implementation: **TS Compiler API** to read decorators/metadata statically
  (matches the project's transformer architecture) — no `require`, no execution, no
  `StubDatabaseProvider`, no spy Proxy.
- Where SQL must come from imperative `MigrationBuilder` calls, define an explicit,
  side-effect-free descriptor contract (e.g. a `describe()` method returning a `SchemaDiff`)
  so the CLI renders SQL via `@ts-linq/migrations` builders instead of running `up()`.
- Commands depend on the ports; the runtime-`require` adapter, if retained as a fallback,
  is isolated and must surface typed errors (no silent swallow).

## Proposed refactor

1. Define `ports/ModelSource.ts` and `ports/MigrationSource.ts` + descriptor types.
2. Implement a `TsCompilerModelSource` (static extraction) as the default; delete or quarantine
   `StubDatabaseProvider` and the spy Proxy once the static path covers the cases.
3. Rewrite `DbContextOptimizeCommand`, `MigrationsScriptCommand`,
   `MigrationsRollbackCommand`, `MigrationsValidateCommand` to consume the ports.
4. Replace every bare `catch {}` in these paths with typed errors (cli/task-3) that report
   the offending file and cause.
5. Keep public command names/flags unchanged.

## Suggested design patterns

- **Port/Adapter (Hexagonal)** — `ModelSource`/`MigrationSource`. Why: swap static analysis
  for runtime require without touching commands; enables fakes in tests.
- **Strategy** — multiple sources (TS compiler vs compiled JS vs runtime fallback). Why:
  graceful support for different project setups.
- **Fail-fast with typed errors** — never emit empty output on load failure. Why: removes
  silent corruption.

## Testing plan

- **Contract tests** for `ModelSource`/`MigrationSource` against fixture projects (TS source
  with decorators) — assert extracted entities/migrations with no DB and no execution.
- **Error-path tests:** malformed/uncompilable source → typed error naming the file (not `[]`).
- **Regression:** `tests-new/migration-script-command.test.ts`,
  `tests/dbcontext-optimize.test.ts`, `tests/migration-rollback.test.ts`,
  `tests/migration-validate.test.ts` updated to the new path.
- **Security regression:** a fixture migration with a module-level side effect must NOT
  execute during `migration:script`.

## Acceptance criteria

- [ ] No command executes user `up()`/constructors to extract SQL/model in the default path.
- [ ] `StubDatabaseProvider` and the spy `Proxy` are removed (or quarantined behind an
      explicit, documented fallback adapter).
- [ ] No bare `catch {}` in these paths; failures throw typed errors naming the file + cause.
- [ ] Command names/flags unchanged.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Define ports + descriptors.
2. Implement TS-compiler static source; cover `dbcontext optimize` first (no SQL execution
   needed — only entity metadata).
3. Migrate the migration commands; remove the stub/spy.

## Notes

This is the largest CLI item and aligns with the existing memory note
"P2-44 DbContextOptimizeCommand — needs refactor to TS Compiler API". Scope can be staged:
land the optimize path first, then the migration-script/rollback/validate paths.
