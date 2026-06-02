---
status: not-started
phase: phase-x
package: cli
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: ["cli/task-1.md"]
---

# Refactor: De-duplicate arg parsing and migration-module loading

## Problem

Two utilities parse CLI flags with byte-for-byte identical algorithms, and three commands
each re-implement the same "register ts-node if needed + `require` migration modules"
loader. This is straightforward duplication that increases the surface for drift and makes
the runtime-execution hack (cli/task-1) harder to excise because it is copy-pasted.

## Evidence

- Identical flag parsers:
  - `packages/cli/src/services/ArgReader.ts:4-16` — `flag(name)`.
  - `packages/cli/src/utils.ts:4-16` — `getFlag(argv, flag)` — same loop, same
    `--name`/`--name=value`/boolean handling.
- Duplicated ts-node-register + module-require loaders:
  - `packages/cli/src/commands/MigrationsScriptCommand.ts:208-214` (`tryRegisterTsNode`) +
    `:141-149` (`require` per file).
  - `packages/cli/src/commands/MigrationsRollbackCommand.ts:65-75` (`tryRegisterTsNode` +
    `requireModule`).
  - `packages/cli/src/commands/MigrationsValidateCommand.ts:87-94` (`ensureTsSupport`) +
    `:108` (`require`).
- Also duplicated: `ensureDir`/`writeFileIfMissing` exist in both `utils.ts:25-34` and the
  `NodeFs` adapter (`adapters/NodeFs.ts:13-20`), giving two filesystem-write paths.

## Why this is bad

- **DRY/drift:** two flag parsers can diverge (e.g. one could later support `-x` short flags
  and the other not); bug fixes must be applied twice.
- **Excision friction:** the duplicated loaders are exactly the runtime-execution code
  cli/task-1 wants to remove; consolidating them first shrinks that change.
- **Two filesystem-write paths** bypass the `FileSystem` port in places, weakening the
  abstraction.

## Target architecture

Apply **DRY** and **single source of truth**: one flag reader, one migration-file
loader/source, one filesystem-write path (the `FileSystem` port).

- Keep `ArgReader` as the single flag parser; replace `utils.getFlag` callers with it (or
  make `getFlag` delegate to `ArgReader`).
- Extract a single `MigrationModuleLoader` (or, preferably, the `MigrationSource` port from
  cli/task-1) used by all three commands; one `tryRegisterTsNode`.
- Route `utils.ensureDir`/`writeFileIfMissing` through the `FileSystem` port (or delete in
  favour of `NodeFs`).

## Proposed refactor

1. Make `utils.getFlag` delegate to `ArgReader` (or migrate its callers and remove it).
2. Extract one ts-node-register helper + one migration-module loader; have the three commands
   consume it (this becomes the runtime-fallback adapter behind cli/task-1's `MigrationSource`).
3. Consolidate filesystem writes on the `FileSystem` port; remove the duplicate `utils`
   helpers or make them thin wrappers.

Public CLI behaviour unchanged.

## Suggested design patterns

- **Single source of truth / Extract Function** — one parser, one loader. Why: removes drift.
- **Adapter** (`FileSystem`) as the only write path. Why: consistent, testable I/O.

## Testing plan

- **Unit:** `tests/arg-reader.test.ts` covers the consolidated parser; add the cases
  `utils.getFlag` covered if any differ.
- **Unit:** the shared loader is exercised by the three command tests via the same fixture.
- **Regression:** `tests/utils.test.ts`, migration command tests pass.

## Acceptance criteria

- [ ] One flag parser; `getFlag` delegates or is removed.
- [ ] One migration-module loader / ts-node helper shared by the three commands.
- [ ] Filesystem writes go through the `FileSystem` port; duplicate `utils` helpers removed
      or made thin wrappers.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Consolidate the flag parser.
2. Extract the shared loader (sets up cli/task-1's fallback adapter).
3. Consolidate filesystem writes.

## Notes

Do this before or alongside cli/task-1 so the runtime-`require` logic lives in exactly one
place when it is replaced/quarantined.
