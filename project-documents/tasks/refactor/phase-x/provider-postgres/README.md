# Refactor Audit: provider-postgres

## Package responsibility
`@ts-linq/provider-postgres` adapts the ts-linq ORM to PostgreSQL via the `pg` Pool. It owns: pool
lifecycle + idle-error handling, health checks, DDL, CRUD + `ON CONFLICT` upsert, transaction
control on a pinned client, `$1..$n` parameters, entity materialization + Postgres type reading
(`convertValueFromPg`), value coercion (ltree/EWKB/JSON), sequence reservation, and SQLSTATE
error/transient translation. Public surface: `PostgresProvider`, `buildPostgresConnectionString`,
ltree-codec, spatial-codec (re-exported via `src/index.ts`).

## Current architectural problems
- **God class.** `PostgresProvider.ts` is 578 LOC across many responsibilities (task-1).
- **Module-global driver + broken `MetricsSafe` import.** `require('pg')` is a module global, and the require-failure fallback references a non-existent `../utils/MetricsSafe` path behind a silent catch, so a missing driver produces no diagnostic (task-7).
- **Diverged triplicated mapper/coercer.** Postgres is the proven-drift copy (routes through `convertValueFromPg`, omits the `undefined` branch); `findWhereIn` casts an array to `SqlParameter` via `unknown` (task-2).
- **Bespoke error mapping** covering only unique/FK; check/not-null collapse to `DatabaseError` (task-3).
- **Implicit capability probing** via `if (!dialect.buildX) throw` (task-4).
- **Raw `ON CONFLICT` upsert SQL** in the provider (task-5).
- **Untestable execution paths**; constructor-only unit tests (task-6, task-7).
- **Duplicated spatial WKB/EWKB codecs** across all three providers (~660 LOC overlap) (task-8).

## Refactor goals
1. Invert the driver dependency and fix the silent broken-import diagnostic.
2. Collapse the cross-provider duplication (mapper/coercer, error registry, spatial codec).
3. Shrink the provider to a delegating facade with explicit capabilities.
4. Move upsert SQL into the dialect; tighten the `findWhereIn` array typing.
5. Preserve the (already correct) pinned-client transaction model as the reference design.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-7 (driver DI + fix MetricsSafe) | P0 | Foundation for testing; fixes a real silent bug |
| 2 | task-6 (contract suite) | P1 | Safety net before structural change |
| 3 | task-3 (error registry) | P1 | Independent; extends coverage |
| 4 | task-2 (shared mapper/coercer + findWhereIn typing) | P1 | Removes proven drift + type hole |
| 5 | task-4 (capabilities) | P1 | Removes hidden feature gaps |
| 6 | task-1 (god-class decomposition) | P0 | Main structural fix; depends on 1–5 |
| 7 | task-5 (upsert → dialect) | P2 | Correct layer |
| 8 | task-8 (shared spatial codec) | P2 | Cross-provider DRY; high-risk binary code |

## Dependencies on other packages
- `@ts-linq/core` (`DatabaseProvider`, geometry model + `isGeometry`) — shared collaborators + codec likely land here.
- `@ts-linq/dialect-postgres` (DDL + SQL gen; receives `buildUpsert` in task-5).
- `@ts-linq/metadata`, `@ts-linq/types` (config/errors + new capability/error types).
- `@ts-linq/metrics-safe` — the correct logging module the provider currently references via a broken relative path (task-7).

## Testing strategy
- Unit (offline, fake `pg` port): contract suite + Postgres cases (RETURNING, client pinning, idle-error, upsert), missing-driver diagnostic.
- Shared spatial-codec spec across formats.
- Dialect snapshot tests for the moved upsert SQL.
- Container-backed `tests/postgres.*` (crud, cte, snapshots) retained as integration coverage.

## Notes
Postgres has the most correct transaction model (pinned client) and the most divergent
mapper/coercer (drift evidence). The broken `MetricsSafe` import (task-7) and the spatial-codec
duplication (task-8) are the standout Postgres-hosted findings; the remaining tasks mirror the
provider-mssql anchors via `depends_on`/`related`.
