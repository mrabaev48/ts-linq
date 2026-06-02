---
status: not-started
phase: phase-x
package: dialect-mssql
priority: P1
effort: XL
risk: high
category: architecture
depends_on: []
related: ['dialect-postgres/task-1.md', 'dialect-postgres/task-2.md', 'dialect-mysql/task-1.md']
---

# Refactor: MSSQL participation in the shared base SQL dialect (Template Method + DialectSyntax)

## Problem
`MssqlDialect` is one of three ~85%-identical dialect classes. The cross-dialect refactor is authored as the
host task `dialect-postgres/task-1.md`. This sibling tracks the MSSQL-specific concerns that the shared base
must preserve as strategy hooks rather than inline branches.

## Evidence
- `packages/dialect-mssql/src/MssqlDialect.ts:79` `buildSelect` shares the universal skeleton but adds MSSQL-only
  pieces: `TOP (n)` head (`:125`), `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY` with the
  ` ORDER BY (SELECT NULL)` fallback (`:129-138`), `@pN` renumbering (`:108-115`), and a temporal clause
  (`:94`, `buildTemporalClause` from `emit-temporal.ts`).
- `buildInsert` emits `OUTPUT INSERTED.[pk] AS id` and returns `returningPk` (`MssqlDialect.ts:159-168`) — a
  dialect-specific RETURNING strategy distinct from PG's `RETURNING *` and MySQL's `LAST_INSERT_ID`.
- `parameterLimit = MSSQL_PARAM_LIMIT` (2100) is far lower than PG/MySQL (65535) — must remain a per-dialect value.

## Why this is bad
- These genuinely-MSSQL behaviors are currently entangled with the duplicated skeleton. Without a base + hooks,
  they will continue to be hand-maintained against the other two copies.

## Target architecture
- Implement the shared `AbstractSqlDialect` (host task) and expose MSSQL specifics via hooks:
  `renderTop`, `renderOffsetFetch` (with the no-ORDER-BY fallback), `renderReturning` (OUTPUT INSERTED),
  `renderParameterMarker` (`@pN`), and `temporalHook` (delegating to `emit-temporal.ts`).
- `DialectSyntax` carries `parameterLimit = 2100` and the `[ ]` quoter.

## Proposed refactor
1. After the host base lands, move MSSQL-only fragments into the named hooks.
2. Keep `emit-temporal.ts` as a collaborator invoked from the temporal hook.
3. Preserve `returningPk` semantics for `MssqlProvider`.

## Suggested design patterns
- **Template Method hook overrides** for TOP/OFFSET-FETCH/OUTPUT/temporal. WHY: isolates the real MSSQL deltas.
- **Strategy** for quoting + parameter limit. WHY: data, not code branches.

## Testing plan
- Run the shared contract suite (`dialect-postgres/task-6.md`) against `MssqlDialect`.
- Keep `tests-new/dialect/MssqlDialect.test.ts` and the temporal tests green.
- Snapshot TOP / OFFSET-FETCH / OUTPUT INSERTED output before/after.

## Acceptance criteria
- [ ] `MssqlDialect` extends the shared base; only MSSQL hooks remain.
- [ ] TOP, OFFSET-FETCH fallback, OUTPUT INSERTED, temporal, `@pN`, and `parameterLimit=2100` preserved.
- [ ] Contract + existing MSSQL tests pass.

## Refactor order
Follow `dialect-postgres/task-1.md`; migrate MSSQL last because its temporal/TOP/OUTPUT hooks are the most divergent.

## Notes
MSSQL is the only dialect supporting temporal queries (PG/MySQL throw `TemporalNotSupportedError`), which makes
the capability model (host `dialect-postgres/task-2.md`) directly relevant: MSSQL should declare `temporal:true`.
