---
title: Spatial Types (NetTopologySuite Equivalent)
ef_core_api: optionsBuilder.UseNetTopologySuite() / Entity<T>.Property(e => e.Location).HasColumnType("geography")
status: not-started
priority: P2
effort: XL
depends_on: []
related: [P2-35-hierarchy-id.md, P2-48-vector-search.md]
ts_linq_packages_touched: [@ts-linq/core, @ts-linq/metadata, @ts-linq/sql-visitor, @ts-linq/dialect-postgres, @ts-linq/dialect-mysql, @ts-linq/dialect-mssql, @ts-linq/provider-postgres, @ts-linq/provider-mysql, @ts-linq/provider-mssql]
---

# Spatial Types (NetTopologySuite Equivalent)

## 1. Why (problem statement)

EF Core integrates with NetTopologySuite (NTS) so users can map `Point`, `LineString`, `Polygon`, etc. directly to PostGIS, SQL Server spatial types, and MySQL spatial columns, then write LINQ predicates like `where(x => x.Location.Distance(other) < 1000)`. `ts-linq` has no spatial primitives, no geometry/geography storage type, and no translation of spatial methods to SQL. Without these, geo-aware apps cannot use `ts-linq`.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
optionsBuilder.UseNpgsql(conn, o => o.UseNetTopologySuite());

modelBuilder.Entity<City>()
    .Property(c => c.Location)
    .HasColumnType("geography (point)");

var nearby = ctx.Cities
    .Where(c => c.Location.Distance(origin) < 10000)
    .OrderBy(c => c.Location.Distance(origin))
    .ToList();
```

TypeScript shape that `ts-linq` must mirror (signatures only, no implementation):

```ts
dbContextOptions.usePostgres(conn, o => o.useSpatial());

modelBuilder.entity<City>()
  .property(c => c.location)
  .hasColumnType('geography(Point)');

const nearby = ctx.cities
  .where(c => c.location.distance(origin).lt(10000))
  .orderBy(c => c.location.distance(origin))
  .toArray();

// Geometry primitives
export interface Point extends Geometry { x: number; y: number; srid: number; }
export interface LineString extends Geometry { coordinates: Point[]; }
export interface Polygon extends Geometry { exterior: LineString; holes: LineString[]; }
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart TB
  A[User LINQ: x.location.distance(origin)] --> B[Expression tree]
  B --> C[Spatial method translator]
  C --> D{Dialect}
  D -->|Postgres| E[ST_Distance via PostGIS]
  D -->|MSSQL| F[geography::STDistance]
  D -->|MySQL| G[ST_Distance_Sphere]
  E & F & G --> H[Dialect SQL]
  H --> I[Provider serializer WKB/WKT]
  I --> J[(DB spatial column)]
```

- **Decision**: Define a dialect-neutral `Geometry` hierarchy in `@ts-linq/core`, register dialect-specific translators, and ship a WKB codec inside each provider.
- **Context**: We already have a dialect abstraction; spatial is a natural extension. PostGIS, MSSQL spatial, and MySQL spatial each speak different function names, so translation must dispatch through dialects.
- **Consequences**: (+) Single user-facing API across dialects. (-) Significant surface area (50+ methods). (~) Adds a WKB dependency per provider.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/core` (geometry primitives), `@ts-linq/metadata` (column type recognition), `@ts-linq/sql-visitor` (method-call translator hooks), `@ts-linq/dialect-*` (spatial function mapping), `@ts-linq/provider-*` (WKB encode/decode).
- **New types / files**:
  - `packages/core/src/spatial/geometry.ts`, `point.ts`, `line-string.ts`, `polygon.ts`, `multi-*.ts`
  - `packages/sql-visitor/src/spatial-method-translator.ts`
  - `packages/dialect-postgres/src/spatial-functions.ts` (ST_* mapping)
  - `packages/dialect-mssql/src/spatial-functions.ts` (`::` static + instance methods)
  - `packages/dialect-mysql/src/spatial-functions.ts`
  - `packages/provider-*/src/spatial-codec.ts`
- **Touch-points**: `packages/sql-visitor/src/method-call-translator.ts` registry, `packages/metadata/src/type-mapping.ts`.
- **Data flow**: Property typed as `Geometry` → metadata records dialect column type → on read, provider decodes WKB → on write, encodes WKB → on query, expression visitor recognizes geometry method calls and dispatches to dialect-specific SQL.

## 5. Implementation options

### Option A — Full NTS-equivalent hierarchy in `@ts-linq/core`
- Pros: One canonical type, identical UX across dialects.
- Cons: Big code surface, must reimplement WKB.
- Effort: XL

### Option B — Adopt an existing TS geo library (e.g. `wkx`, `turf`)
- Pros: Less code to write.
- Cons: Pulls a heavy dependency into `@ts-linq/core`; API drift from EF.

### Recommendation
Option A — keep `@ts-linq/core` dependency-free; isolate WKB inside providers where a small inline codec suffices.

## 6. Related problems / follow-up tasks

- `[P2-35](./P2-35-hierarchy-id.md)` — another database-specific type system; share registration pattern.
- `[P2-48](./P2-48-vector-search.md)` — vectors share the "non-relational column type" registration mechanism.

## 7. Acceptance criteria

- [ ] Public API mirrors EF Core NTS surface (`Distance`, `Intersects`, `Within`, `Buffer`, `Area`, `Length`, `Contains`)
- [ ] Unit tests cover WKB round-trip for Point / LineString / Polygon
- [ ] Integration test against PostGIS, MSSQL spatial, MySQL spatial
- [ ] Docs in `apps/docs/` updated with per-dialect setup
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
