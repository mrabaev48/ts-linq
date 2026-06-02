---
status: not-started
phase: phase-x
package: cli
priority: P0
effort: L
risk: high
category: provider
depends_on: []
related: ["cli/task-3.md", "cli/task-5.md"]
---

# Refactor: Unify provider construction and secret handling behind ProviderFactory

## Problem

Provider construction exists in two independent implementations with duplicated, drifting
connection-string parsing, unsafe type casts, and credential handling that is not redacted.
A `ProviderFactory` port and an `EnvProviderFactory` adapter already exist but are largely
bypassed — most commands call the free function `createProviderFromEnv` directly, so the
abstraction provides no value and the duplication has no single owner.

## Evidence

- `packages/cli/src/provider-factory.ts:8-131` — `createProviderFromEnv` plus `createPg`/
  `createMy`/`createMs`, each parsing a URL or `;`-delimited connection string and building a
  provider, returning `… as unknown as DatabaseProvider` (lines 67, 92, 128) — a double cast
  that defeats type checking.
- `packages/cli/src/commands/ScaffoldCommand.ts:74-125` — `createProvider` re-implements the
  *same* Postgres URL parsing, MySQL URL parsing, and MSSQL `;`-string parsing, again with
  `as unknown as DatabaseProvider` (lines 88, 100, 124).
- `packages/cli/src/adapters/EnvProviderFactory.ts:6-10` — the adapter merely forwards to the
  free function; `ports/ProviderFactory.ts` defines the interface but `cli.ts:72` and other
  DB commands call `createProviderFromEnv()` directly, not the port.
- `packages/cli/src/provider-factory.ts:25,73,98` — connection strings (with passwords) are
  read from env; there is no redaction, and errors/logs elsewhere may echo the raw string.
- `packages/cli/src/cli.ts:72-78` — `createProviderFromEnv()` is invoked inline in the
  dispatcher (hardcoded), so commands cannot be given a fake provider in tests without
  monkey-patching env.

## Why this is bad

- **DRY / drift:** two parsers for the same formats already differ (Scaffold omits pool/
  health/circuit and several params). Bug fixes must be applied twice.
- **Type safety:** `as unknown as DatabaseProvider` hides real shape mismatches between the
  provider constructors and the `DatabaseProvider` contract.
- **Security:** credentials in connection strings are not redacted; an error or debug log can
  leak passwords.
- **Dead abstraction:** the `ProviderFactory` port exists but is bypassed, giving a false
  sense of testability.

## Target architecture

Apply **dependency inversion** and **DRY**: one connection-string parser, one provider
factory implementing the port, consumed everywhere via the port (composition-first).

- `ConnectionStringParser` (Strategy per dialect) producing a typed, dialect-specific options
  object; one home for URL and `;`-string parsing.
- `ProviderFactory.create(spec)` builds providers from parsed options; remove `as unknown as`
  by aligning the provider constructor option types (or adding a typed adapter at the seam).
- All commands receive a `ProviderFactory` via constructor injection (the DI seam already
  exists for logger/fs); `ScaffoldCommand` uses the same factory + parser instead of its own.
- A `redactConnectionString()` helper used wherever a connection string could be logged or
  embedded in an error.

## Proposed refactor

1. Extract `ConnectionStringParser` with per-dialect parse functions (move logic out of
   `provider-factory.ts` and `ScaffoldCommand`).
2. Make `EnvProviderFactory`/a new `ProviderFactory` impl the single construction path; keep
   `createProviderFromEnv` as a thin back-compat wrapper.
3. Inject `ProviderFactory` into DB commands and `ScaffoldCommand`; delete the duplicate
   parser in `ScaffoldCommand`.
4. Replace `as unknown as DatabaseProvider` with a typed seam.
5. Add and apply `redactConnectionString()` in all error/log sites that touch connection
   strings.

Public behaviour (env vars, flags) unchanged.

## Suggested design patterns

- **Factory** (`ProviderFactory`) — single construction authority. Why: one place to add
  dialects/options; injectable for tests.
- **Strategy** (`ConnectionStringParser` per dialect). Why: removes duplicated parsing.
- **Adapter** at the provider-constructor seam. Why: replace `as unknown as` with a typed
  boundary.
- **Dependency Injection** into commands. Why: testable without env monkey-patching.

## Testing plan

- **Unit:** parser produces correct options for representative PG/MySQL URLs and MSSQL
  `;`-strings, including ssl/schema/pool params.
- **Unit:** `redactConnectionString` masks passwords.
- **Command tests:** `ScaffoldCommand` and DB commands accept an injected fake factory and
  never touch real env.
- **Regression:** `tests/provider-factory-pool.test.ts` still passes.

## Acceptance criteria

- [ ] One connection-string parser; `ScaffoldCommand`'s copy is removed.
- [ ] One `ProviderFactory` consumed via the port by all provider-needing commands.
- [ ] No `as unknown as DatabaseProvider` casts in provider construction.
- [ ] Connection strings are redacted in all log/error paths.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Extract the parser.
2. Consolidate the factory + port; wire `createProviderFromEnv` as a wrapper.
3. Inject into commands; remove the Scaffold duplicate; remove casts; add redaction.

## Notes

Coordinate with cli/task-5 (schema-inspect also parses provider specifics) and cli/task-3
(error model will own redaction-safe messages).
