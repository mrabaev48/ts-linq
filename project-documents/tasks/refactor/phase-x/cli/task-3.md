---
status: not-started
phase: phase-x
package: cli
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["cli/task-1.md", "cli/task-4.md"]
---

# Refactor: Standardize CLI error model and exit-code contract

## Problem

Error handling and exit codes are ad-hoc and inconsistent across commands. The same logical
failure ("required input missing", "file not found") maps to exit code `1` in some commands
and `2` in others. The top-level handler dumps the raw error object. Several `catch` blocks
swallow errors silently, and one path masks the original error's cause.

## Evidence

- Exit-code inconsistency for similar conditions:
  - `packages/cli/src/commands/DbContextOptimizeCommand.ts:45,61,71` use `exitCode = 1` for
    missing/invalid input.
  - `packages/cli/src/commands/ScaffoldCommand.ts:28,36` use `exitCode = 1` for missing input.
  - `packages/cli/src/commands/SchemaValidateCommand.ts:31`,
    `MigrationsValidateCommand.ts:25`, `MigrationsDryRunCommand.ts:31`,
    `SchemaDiffCommand.ts:31`, `SeedCommand.ts:24`, `GenerateEntityCommand.ts:32,63`,
    `SchemaApplyCommand.ts:33,52` use `exitCode = 2` for missing input / not-found.
- `packages/cli/src/cli.ts:85-88` — `main().catch((err) => { console.error(err); process.exit(1) })`
  dumps the raw error (stack, possibly connection string) and always exits `1`.
- Silent swallow:
  - `packages/cli/src/commands/MigrationsScriptCommand.ts:147,168,211` — bare `catch {}`.
  - `packages/cli/src/commands/MigrationsRollbackCommand.ts:68,92` — bare `catch {}`.
  - `packages/cli/src/commands/MigrationsValidateCommand.ts:91` — bare `catch {}`
    (ts-node register; acceptable, but undistinguished).
  - `packages/cli/src/config.ts:19-22` — `catch (e) { console.error(...); return undefined }`
    swallows a config-load failure into "no config".
- `packages/cli/src/utils.ts:39` — `validateEnv` logs via `console.error` directly (bypasses
  the `Logger` port).

## Why this is bad

- **Unscriptable:** CI/automation cannot rely on exit codes when `1` vs `2` is arbitrary.
- **Leaky errors:** the top-level dump can print credentials/stack to stderr.
- **Hidden failures:** silent `catch {}` and config swallow make misconfiguration look like
  normal operation.
- **Bypassed logging port:** `console.error` in `utils`/`config`/`cli` defeats the injected
  `Logger` abstraction.

## Target architecture

Apply **error-handling-patterns** guidance: a small typed CLI error hierarchy with stable
exit codes, a single top-level boundary that maps errors→exit codes and prints user-safe
messages, and the `Logger` port used everywhere.

- `CliError extends Error { exitCode: number; code: string; }` with leaves like
  `UsageError` (exit 2), `NotFoundError` (exit 2 or a dedicated code), `ProviderError`,
  `ExecutionError` (exit 1).
- A documented exit-code convention (e.g. `0` ok, `1` runtime failure, `2` usage/validation,
  `3` drift-check failure) applied consistently.
- One top-level handler in `cli.ts` that catches `CliError` (prints `message`, exits with
  `exitCode`) and unexpected errors (prints a generic message + redacted detail, exits `1`).
- Replace every bare `catch {}` with either a deliberate, commented recovery or a typed error.
- Route `utils`/`config` logging through the `Logger` port.

## Proposed refactor

1. Add `errors/CliError.ts` + leaves + the exit-code constants.
2. Convert per-command `process.exitCode = …; return` patterns to throwing `UsageError`/etc.,
   handled centrally.
3. Implement the single top-level handler in `cli.ts` (with redaction from cli/task-2).
4. Audit each `catch {}`: keep+comment valid recoveries (ts-node optional), convert the rest.
5. Inject `Logger` into `config.tryLoadConfig`/`utils.validateEnv` (or return typed results).

## Suggested design patterns

- **Typed error hierarchy + exit-code mapping** — branchable failures with deterministic
  codes. Why: scriptability + user-safe output.
- **Boundary handler (single catch at the edge)** — Clean Architecture's error boundary.
  Why: one place owns process exit + redaction.
- **Guard clauses** for usage validation throwing `UsageError`. Why: removes scattered
  `exitCode` assignments.

## Testing plan

- **Unit:** each `CliError` leaf carries the right `exitCode`/`code`.
- **Dispatch tests:** invalid usage → exit 2; runtime failure → exit 1; drift check → its
  code; success → 0 (using the injectable dispatcher from cli/task-4).
- **Error-path tests:** previously-silent `catch` sites now surface typed errors.
- **Redaction test:** top-level handler does not print connection-string secrets.

## Acceptance criteria

- [ ] A documented exit-code convention applied across all commands.
- [ ] One top-level error boundary in `cli.ts`; commands throw typed `CliError`s.
- [ ] No silent `catch {}` except explicitly-commented optional recoveries.
- [ ] `config`/`utils` use the `Logger` port, not `console`.
- [ ] Top-level output is user-safe (no raw stack/secrets by default).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Add `CliError` + exit-code constants.
2. Add the top-level boundary.
3. Migrate commands to throw; audit `catch` sites.

## Notes

Pairs with cli/task-4 (injectable dispatch makes exit-code assertions clean) and cli/task-2
(redaction).
