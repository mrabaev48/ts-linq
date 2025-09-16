# Changelog

All notable changes to this project will be documented in this file.

## 1.1.0

- Migrations/emitters:
  - Extracted UNIQUE and CHECK handling into dialect emitters (PG/MySQL/MSSQL/SQLite base).
  - `MigrationSqlBuilder`: split column changes into add/alter/drop; added UNIQUE/CHECK operations; implemented SQLite rebuild flow (create \__new_, copy, drop, rename, recreate indexes/unique) using `finalSnapshot` in `TableDiff`.
- CLI:
  - `migrate --transaction` for diff mode.
  - `seed --transaction` for SQL/TS seeds.
  - JSON output for TS/JS seeds (`{ ok, file, script, durationMs }`) and SQL seeds now include `durationMs`.
  - `diff --details` shows expected/actual/diff snapshots.
- Tests:
  - Extended unit tests for emitters (UNIQUE/CHECK).
  - Added conditional e2e tests for PG/MySQL/MSSQL diff/verify (skipped without env).
- Docs:
  - CLI help updated for new flags.
  - Added guide: `docs/guides/sqlite-rebuild.md`.

## 1.0.0

- Initial release with:
  - SQLite/PostgreSQL/MSSQL/MySQL providers
  - Queryable with joins, includes, groupBy/having, pagination
  - Middleware pipeline and SQL logging
  - Soft delete and audit stamping
  - Extended LINQ: subqueries and UNION/UNION ALL
  - Migrations API and tests
