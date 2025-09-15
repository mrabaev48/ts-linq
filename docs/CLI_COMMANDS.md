# ts-linq CLI — Commands & Flags

This document summarizes the CLI commands, flags, and usage examples. See `CLI_ARCHITECTURE.md` for architectural details.

## Global flags
- `--provider=sqlite|postgresql|mysql|mssql`
- `--conn=<connectionString>`
- `--cwd=<path>`
- `--json` (machine-friendly output when supported)
- `--dry-run` (compute/print plan without executing)
- `--verbose` / `--quiet`
- `--yes` (suppress confirmations)

## init
Initialize config and folders.

```
ts-linq init
```

Creates `tslinq.config.json`, `migrations/`, `seeds/`, and sample `seeds.sql` if missing.

## config print
Print effective configuration after resolving env and defaults.

```
ts-linq config print --json
```

## status
Show applied migrations history.

```
ts-linq status [--json]
```

## diff
Compute schema diff (metadata vs DB) and output SQL plan.

Flags:
- `--json` — output `{ steps: string[] }`
- `--details` — include `{ expected, actual, diff }` in JSON
- `--out=<file>` — write SQL plan to file
- `--create` — scaffold a migration file from diff
- `--name=<ClassName>` — name for scaffolded class/file

Examples:
```
ts-linq diff --json --details
ts-linq diff --create --name=InitSchema
ts-linq diff --out plan.sql
```

## migrate
Apply explicit migrations, or fallback to diff (for SQLite/demo).

Flags:
- `--to=<version>` — apply until version (inclusive)
- `--step=<N>` — limit number of migrations
- `--dry-run` — print plan without executing

```
ts-linq migrate --dry-run
```

## rollback
Rollback explicit migrations down to a target.

Flags:
- `--to=<version>`

```
ts-linq rollback --to 20250101000000
```

## generate migration <Name>
Create `migrations/<ts>_<Name>.ts` scaffold with `up/down`.

```
ts-linq generate migration AddUsers
```

## generate entity <Name>
Create an entity class with decorators.

Flags:
- `--dir=<path>` — target directory (default `src/entities`)
- `--pk=<name>` — primary key property (default `id`)
- `--columns=a:string,b:number?` — extra columns; `?` marks nullable

```
ts-linq generate entity User --dir=src/domain --pk=id --columns=name:string,age:number?,createdAt:date
```

## seed
Apply seeds from `.sql` or `.ts/.js` script.

- SQL: file split by `;` and executed sequentially
- TS/JS: must export `async function run(provider){ ... }`

Flags:
- `--file=<path>` (or pass the path as positional arg)
- `--yes` — suppress warning
- `--dry-run` — report plan only

```
ts-linq seed --file ./seeds.sql --yes
ts-linq seed ./seeds/seeds.ts --yes
```

## verify
Verify migration checksums.

Modes:
- Baseline file mode (default): checksum of `migrations/index.*` stored in `.tslinq.checksum`
- DB mode (`--db`): per-file checksums stored in table `__migration_checksums`

Flags:
- `--db` — use DB checksums store
- `--dry-run` — report actions only
- `--json` — structured output

```
ts-linq verify --json
ts-linq verify --db --json
```

## Exit codes
- `0` — success
- `1` — internal error
- `2` — invalid arguments / input
- `3` — checksum mismatch (verify)
- `4` — could not acquire migration lock

## Tips
- Use `--details` with `diff --json` to integrate with external tooling.
- Prefer explicit migration classes for production; diff is great for scaffolding.
- For TS configs/entities, the CLI autoloads `ts-node/register/transpile-only` and `reflect-metadata`.
