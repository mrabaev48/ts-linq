---
title: Database-First Scaffolding (Reverse Engineer)
ef_core_api: dotnet ef dbcontext scaffold "Conn" Microsoft.EntityFrameworkCore.SqlServer
status: done
priority: P2
effort: L
depends_on: []
related: [P2-42-migration-bundles-idempotent.md]
ts_linq_packages_touched: [@ts-linq/migrations, @ts-linq/metadata, @ts-linq/dialect-postgres, @ts-linq/dialect-mysql, @ts-linq/dialect-mssql]
---

# Database-First Scaffolding (Reverse Engineer)

## 1. Why (problem statement)

EF Core's `Scaffold-DbContext` / `dotnet ef dbcontext scaffold` introspects an existing database and generates entity classes, a DbContext, and fluent configuration. This is the only realistic onramp for users with legacy schemas. `ts-linq` is code-first only today, blocking adoption for brownfield migrations from EF or other ORMs. Adding a scaffolder for the three supported dialects unlocks this path.

## 2. EF Core reference syntax (must be preserved verbatim)

```bash
dotnet ef dbcontext scaffold \
    "Host=localhost;Database=app;Username=...;Password=..." \
    Npgsql.EntityFrameworkCore.PostgreSQL \
    --output-dir Models \
    --context AppContext \
    --use-database-names \
    --no-pluralize
```

TypeScript shape that `ts-linq` must mirror (signatures only, no implementation):

```bash
pnpm ts-linq scaffold \
  --connection "postgres://user:pass@host/app" \
  --provider postgres \
  --output-dir src/models \
  --context AppContext \
  --use-database-names \
  --no-pluralize
```

```ts
// Programmatic alternative
import { scaffoldDbContext } from '@ts-linq/migrations/scaffold';

await scaffoldDbContext({
  connection: 'postgres://...',
  provider: 'postgres',
  outputDir: 'src/models',
  contextName: 'AppContext',
  useDatabaseNames: true,
  pluralize: false,
});
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart TB
  A[Connection string] --> B[Dialect introspector]
  B --> C[Information schema reader]
  C --> D[Database model: tables + cols + FKs + indexes]
  D --> E[Name normalizer pluralize/casing]
  E --> F[Code generator templates]
  F --> G[entity .ts files]
  F --> H[DbContext .ts file]
```

- **Decision**: Each dialect exposes an `Introspector` that returns a normalized `DatabaseModel`; a single code generator turns that into TS files via templates.
- **Context**: Information schema is broadly standard but each dialect has nuances (PG sequences, MSSQL identity, MySQL `AUTO_INCREMENT`). Per-dialect introspectors with a common output type is the cleanest split.
- **Consequences**: (+) One code generator, three thin introspectors. (-) Initial template style is opinionated and may not match every team. (~) Round-trip with code-first migrations needs care.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/migrations` (CLI + generator), `@ts-linq/metadata` (database model intermediate), `@ts-linq/dialect-*` (introspectors).
- **New types / files**:
  - `packages/migrations/src/scaffold/scaffold-db-context.ts`
  - `packages/migrations/src/scaffold/templates/entity.tpl.ts`
  - `packages/migrations/src/scaffold/templates/db-context.tpl.ts`
  - `packages/migrations/src/scaffold/name-normalizer.ts` (pluralize, casing)
  - `packages/dialect-postgres/src/introspector.ts` (`information_schema` + `pg_catalog`)
  - `packages/dialect-mysql/src/introspector.ts`
  - `packages/dialect-mssql/src/introspector.ts` (`sys.tables`, `sys.columns`)
- **Touch-points**: CLI entry; no runtime touch in `@ts-linq/orm`.
- **Data flow**: Connect → query catalog → produce `DatabaseModel` → normalize names → render templates → write `.ts` files.

## 5. Implementation options

### Option A — Per-dialect introspectors, shared generator
- Pros: Clean split; new dialects plug in.
- Cons: Template choices baked in.
- Effort: L

### Option B — Use existing tools (`schemats`, `kysely-codegen`) under the hood
- Pros: Less code.
- Cons: Output style mismatch; runtime semantics we need (computed cols, default value capture) are incomplete.

### Recommendation
Option A — we control the output style and can match `ts-linq` metadata exactly.

## 6. Related problems / follow-up tasks

- `[P2-42](./P2-42-migration-bundles-idempotent.md)` — inverse direction. Model snapshot type should be the source of truth on both sides.

## 7. Acceptance criteria

- [ ] CLI `scaffold` works against PG / MySQL / MSSQL
- [ ] Generated entities round-trip through metadata without diff
- [ ] Naming options (`--use-database-names`, `--no-pluralize`) honored
- [ ] Composite PKs, FKs, indexes, defaults, identity reproduced
- [ ] Unit tests for each dialect introspector against a known fixture DB
- [ ] Docs in `apps/docs/` updated
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
