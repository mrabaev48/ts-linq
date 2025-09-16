# ts-linq CLI Architecture

## High-level

- Binary entry: `src/bin/ts-linq-cli.ts` — parses argv, registers commands in `CommandRegistry`, delegates to handlers.
- Commands live in `src/cli/commands/*.ts`, each implements `Command { execute(args, flags, context?) }`.
- Runtime utilities in `src/cli/runtime/*`: args parsing, config resolution, bootstrap (reflect-metadata, ts-node, entities autoload).
- Ports/Adapters (DIP): `ports.ts` define `FsPort`, `ProcessPort`, `ChecksumPort`, `CliLogger`; `nodeAdapters.ts` provide Node-based implementations.

## Key commands

- diff: builds snapshots (metadata vs DB via inspectors), compares, emits SQL steps; flags: `--json`, `--out`, `--create`, `--name`, `--details`.
- migrate/rollback: use `MigrationRunner` (transactions, history, advisory locks), supports `--dry-run` in migrate fallback path.
- verify: file baseline mode (checksum for `migrations/index.*`) and `--db` mode (per-file checksums table `__migration_checksums`).
- seed: executes `.sql` (split by `;`) and `.ts/.js` scripts that export `async run(provider)`. Flags: `--yes`, `--dry-run`.

## Diff engine

- Inspectors for sqlite/pg/mysql/mssql under `src/migrations/SchemaInspector.ts`.
- Diff types under `src/migrations/DiffTypes.ts`: column/index/fk/unique/check, normalization for DEFAULT/CHECK/index where/expr.
- SQL generator under `src/migrations/DialectMigrationSql.ts`: per-dialect DDL, including DROP INDEX, ALTER TYPE/DEFAULT, UNIQUE/CHECK nuances for SQLite.

## Error/exit codes

- Handlers return numeric codes; bin sets `process.exitCode` and prints JSON when `--json`.

## Extensibility

- Add a new command by creating `src/cli/commands/<name>.ts` and registering in `bin`.
- Add new provider/dialect by implementing inspector pieces and mapping in diff generator; avoid `any`, use existing types.

## Testing

- CLI tests spawn `ts-node/register/transpile-only` with the bin; rely on temp dirs and minimal configs.
- Unit tests cover diff/snapshots normalization and SQL generation.

## Quality

- Clean Code, SOLID, small functions, explicit names; no empty catch; no `any`.
