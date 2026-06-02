# CLAUDE.md — @ts-linq/cli

## Role

The `ts-linq` **command-line tool** for the DB lifecycle: migrations, schema diff/apply, code
generation, scaffolding, compiled-model optimization, seeding, metrics endpoint.

## Hard boundaries

- Depends on `core`, `metadata`, `types`, `migrations` + `typescript` (peer).
- Keep the ports & adapters separation: command logic depends on `ports/` interfaces
  (`FileSystem`, `Logger`, `ProviderFactory`), not Node built-ins directly. New side effects → new
  port + adapter, so commands stay unit-testable.

## Critical invariants & known hazards

- **`bootstrap/StubDatabaseProvider` + require()-based runtime execution is core tech debt.**
  `dbcontext:optimize` currently loads and runs the user's context at runtime via `require()` and a
  stub provider. The intended direction is static analysis via the TS Compiler API (refactor
  `task-1`, P0; see also the P2-44 tech-debt memory note). Don't deepen the runtime-execution path.
- **Provider construction + secrets** must funnel through one `ProviderFactory` with safe secret
  handling — don't read env/secrets ad hoc in individual commands (refactor `task-2`, P0).
- **Command failures must not be swallowed into empty output.** Surface errors and set a non-zero
  exit code (refactor `task-3`).

## Public API surface & stability

- The `bin` (`ts-linq`) command set + flags is the user-facing contract. `src/index.ts` also
  exports programmatic pieces.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/cli/` (2× P0: replace require-based execution / stub
provider; unify provider factory + secrets).

## Validation

```bash
pnpm --filter @ts-linq/cli typecheck
pnpm --filter @ts-linq/cli lint
pnpm --filter @ts-linq/cli build
```

Smoke-test the built `dist/cli.js` for any command you change.

## Do / Don't

- **Do** add a port+adapter for new I/O; keep commands testable.
- **Do** return proper exit codes and surface errors.
- **Don't** expand the `require()`/stub-provider runtime path.
- **Don't** read secrets directly inside commands.
