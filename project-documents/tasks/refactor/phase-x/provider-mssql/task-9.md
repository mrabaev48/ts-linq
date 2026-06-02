---
status: not-started
phase: phase-x
package: provider-mssql
priority: P2
effort: S
risk: medium
category: sql
depends_on: []
related: []
---

# Refactor: Validate/quote savepoint identifiers and reconcile the unused MSSQL connection string

## Problem
Two MSSQL-specific consistency/safety issues:
1. Savepoint and `nextSequenceValue` SQL interpolate caller-provided names directly into SQL with
   no validation or quoting, enabling identifier injection if a name is attacker-influenced.
2. `buildMssqlConnectionString(config)` is computed and passed to `super(...)`, but `doConnect`
   ignores it and rebuilds a separate `mssqlConfig` object from `this.config`. The connection
   string is effectively dead for the real connection path (used only by tests/`connectionString`
   field), creating two divergent sources of truth for connection configuration.

## Evidence
- Savepoint interpolation: `MssqlProvider.ts:533` `SAVE TRANSACTION ${name}`, `:537` `ROLLBACK TRANSACTION ${name}`.
- Sequence interpolation: `:564` builds `[${schema}].[${sequenceName}]` (brackets help but inner `]` is not escaped).
- Connection string computed: constructor `:81` `buildMssqlConnectionString(config)` → `super(connectionString, ...)`.
- Connection string ignored on connect: `doConnect :115-142` builds `mssqlConfig` from `this.config` fields and constructs `new ConnectionPool(mssqlConfig)` — never uses `this.connectionString`.

## Why this is bad
- Identifier injection via savepoint/sequence names is a real (if narrow) SQL-safety gap; sequence brackets don't escape an embedded `]`.
- Two connection-config representations (string vs object) drift; the string-based tests assert behavior the production path doesn't use, giving false confidence.

## Target architecture
Centralize identifier handling through the dialect's `quoteIdentifier`/escaping, and make the
connection-configuration model single-sourced. Clean Code: one source of truth; validated inputs
at the boundary. SOLID: SRP (connection-config assembly owned by one collaborator — ties to
`MssqlConnectionManager` in `task-1.md`).

## Proposed refactor
1. Route savepoint and sequence identifiers through the dialect's quoting/escaping (escape embedded `]` → `]]`), or validate against a strict `[A-Za-z_][A-Za-z0-9_]*` pattern and reject otherwise with a typed error.
2. Decide one connection-config source: either drive `doConnect` from the connection string, or stop computing the string for the real path and keep the object — and align the connection-string tests accordingly.
3. Move connection-config assembly into the `MssqlConnectionManager` collaborator from `task-1.md`.

## Suggested design patterns
- **Value Object** — a validated `SavepointName` / `SequenceName` wrapper, or a guard at the boundary.
- **Single source of truth** for connection configuration.

## Testing plan
- Unit: savepoint/sequence name with `]`, spaces, or `;` is rejected or safely escaped.
- Unit: connection-config assembly produces the expected driver config (no reliance on the dead string path).
- Regression: existing connection-string tests updated to match the chosen single source.

## Acceptance criteria
- [ ] Savepoint and sequence identifiers are validated or properly escaped.
- [ ] Embedded `]` in a bracketed identifier is escaped.
- [ ] Exactly one connection-configuration representation drives `doConnect`.
- [ ] Tests reflect the single source of truth.

## Refactor order
Fold the connection-config part into `task-1.md`; the identifier-safety part can land independently.

## Notes
MySQL/PG savepoint names are similarly interpolated (`MySqlProvider.ts:441`,`:447`,`:453`); the
identifier-validation helper should be shared. Captured here as MSSQL-led due to the extra
dead-connection-string concern.
