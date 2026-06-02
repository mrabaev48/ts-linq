---
status: not-started
phase: phase-x
package: cli
priority: P1
effort: M
risk: medium
category: architecture
depends_on: []
related: ["cli/task-2.md", "cli/task-3.md"]
---

# Refactor: Injectable composition root and testable dispatch

## Problem

`cli.ts` is a hardcoded composition root: it `new`s all 18 commands inline, reads
`process.argv` and calls `process.exit` directly, and decides DbCommand-vs-Command by
duck-typing `runDb`. There is no seam to inject argv, the command set, the provider factory,
or the exit mechanism, so end-to-end dispatch (including exit codes and the DbCommand
connect/disconnect lifecycle) cannot be unit-tested.

## Evidence

- `packages/cli/src/cli.ts:29-83` — `main()` reads `process.argv.slice(2)`, builds
  `new CommandRegistry([... 18 × new XCommand() ...])` inline, and runs the command.
- `packages/cli/src/cli.ts:69-79` — DbCommand detection via
  `typeof maybeDb.runDb === 'function'`, then `createProviderFromEnv()` + connect/finally
  disconnect — all hardcoded, not injectable.
- `packages/cli/src/cli.ts:64,87` — `process.exitCode`/`process.exit(1)` and `console.error`
  used directly in the dispatcher.
- `packages/cli/src/CommandRegistry.ts:7-30` — the registry is fine and injectable, but the
  *list* of commands is constructed in `cli.ts`, not provided to it.

## Why this is bad

- **Untestable dispatch:** verifying "unknown command → exit 2", "DbCommand connects then
  disconnects even on failure", or "exit code propagates" requires spawning a real process.
- **Rigid wiring:** adding/removing commands, swapping the provider factory, or capturing
  output for tests all require editing the entry file.
- **Mixed responsibilities:** the entry file owns argv parsing, wiring, lifecycle, error
  handling, and process control at once.

## Target architecture

Apply **Clean Architecture** (a thin `main` at the very edge; a testable application core)
and **dependency inversion**.

- Extract a `CliApplication` class with `run(argv): Promise<number>` that takes injected
  `{ registry, providerFactory, logger, exit? }` and returns an exit code (does not call
  `process.exit`).
- `cli.ts` becomes a 5-line shell: build defaults, `process.exit(await app.run(process.argv.slice(2)))`.
- A `buildDefaultRegistry()` factory creates the command list (so tests can substitute a
  subset).
- The DbCommand lifecycle (connect/run/finally-disconnect) lives in `CliApplication`,
  consuming the injected `ProviderFactory` (cli/task-2) and producing exit codes via the
  error boundary (cli/task-3).

## Proposed refactor

1. Add `CliApplication` encapsulating dispatch + DbCommand lifecycle, returning an exit code.
2. Add `buildDefaultRegistry()` (moves the 18 `new` calls out of `main`).
3. Reduce `cli.ts` to wiring + `process.exit(code)`.
4. Inject `ProviderFactory` (cli/task-2) and `Logger` rather than calling free functions.

Public CLI behaviour (command names, output) unchanged.

## Suggested design patterns

- **Composition Root** — one explicit place wires concrete classes; `main` stays trivial.
  Why: testability + single wiring point.
- **Dependency Injection** — registry/factory/logger/exit injected into `CliApplication`.
  Why: dispatch becomes a pure-ish unit under test.
- **Facade** (`CliApplication.run`) returning an exit code. Why: decouples logic from
  `process.exit`.

## Testing plan

- **Unit:** `CliApplication.run(['unknown'])` → returns 2; `run([])` → returns 2 with help.
- **Unit:** a fake DbCommand asserts connect→runDb→disconnect order, and disconnect on
  `runDb` throwing.
- **Unit:** exit code from a command's thrown `CliError` (cli/task-3) propagates as the
  return value.
- **Regression:** `tests/cli-dispatch.test.ts`, `tests/cli-help-aliases.test.ts`,
  `tests/CommandRegistry.test.ts` pass (extend to use the injectable app).

## Acceptance criteria

- [ ] `CliApplication.run(argv)` returns an exit code and never calls `process.exit`.
- [ ] `cli.ts` is a thin shell that only wires defaults and exits.
- [ ] Command list is produced by `buildDefaultRegistry()` and substitutable in tests.
- [ ] DbCommand connect/disconnect lifecycle is unit-tested with a fake provider factory.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Extract `buildDefaultRegistry()`.
2. Extract `CliApplication` (dispatch + lifecycle), return exit codes.
3. Slim `cli.ts`; integrate cli/task-2 factory and cli/task-3 boundary.

## Notes

Best landed together with cli/task-3 (exit-code contract) since the two share the boundary.
