---
title: Vector and Hybrid Search (Cosmos + pgvector)
ef_core_api: EF.Functions.VectorDistance(...) / EF.Functions.FullTextContains(...)
status: not-started
priority: P2
effort: L
depends_on: [P2-37-cosmos-provider.md]
related: [P2-34-spatial-types.md, P2-37-cosmos-provider.md]
ts_linq_packages_touched: [@ts-linq/core, @ts-linq/query, @ts-linq/sql-visitor, @ts-linq/dialect-cosmos, @ts-linq/dialect-postgres]
---

# Vector and Hybrid Search (Cosmos + pgvector)

## 1. Why (problem statement)

EF Core 9 (preview) introduced vector and hybrid (vector + full-text) search for Cosmos DB, mirroring growing demand from AI/RAG workloads. Postgres has a parallel story via the `pgvector` extension, widely used outside the EF world. `ts-linq` has no vector primitive and no `Distance`/`Top-K` translation; adding it across Cosmos and Postgres positions `ts-linq` as a credible ORM for AI-first apps without forcing a separate vector DB.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
modelBuilder.Entity<Article>()
    .Property(a => a.Embedding)
    .HasVectorDimensions(1536);

var matches = ctx.Articles
    .OrderBy(a => EF.Functions.VectorDistance(a.Embedding, query, "cosine"))
    .Take(10)
    .ToList();

// Hybrid:
var hybrid = ctx.Articles
    .Where(a => EF.Functions.FullTextContains(a.Body, "claude"))
    .OrderBy(a => EF.Functions.VectorDistance(a.Embedding, query, "cosine"))
    .Take(10)
    .ToList();
```

TypeScript shape that `ts-linq` must mirror (signatures only, no implementation):

```ts
modelBuilder.entity<Article>()
  .property(a => a.embedding)
  .hasVectorDimensions(1536);

const matches = ctx.articles
  .orderBy(a => ef.functions.vectorDistance(a.embedding, query, 'cosine'))
  .take(10)
  .toArray();

const hybrid = ctx.articles
  .where(a => ef.functions.fullTextContains(a.body, 'claude'))
  .orderBy(a => ef.functions.vectorDistance(a.embedding, query, 'cosine'))
  .take(10)
  .toArray();

export type Vector = Float32Array;
export type VectorDistanceMetric = 'cosine' | 'euclidean' | 'dotProduct';
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  A[orderBy(vectorDistance)] --> B[Expression visitor]
  B --> C{Dialect}
  C -->|Cosmos| D[VectorDistance built-in]
  C -->|Postgres + pgvector| E[<=> operator with metric op class]
  D --> F[Cosmos SQL with TOP K]
  E --> G[Postgres SELECT ORDER BY embedding <=> $1 LIMIT 10]
  F & G --> H[(DB)]
  I[hasVectorDimensions] --> J[Metadata: vector column type]
  J --> K[Migrations: CREATE EXTENSION vector / Cosmos vector indexing policy]
```

- **Decision**: Add a portable `Vector` type backed by `Float32Array`; translate `ef.functions.vectorDistance` to Cosmos `VectorDistance(...)` or pgvector `<=>`/`<#>`/`<->` operators based on metric.
- **Context**: Vector ops are first-class in both targets but spelled differently. A common API with dialect dispatch is consistent with our spatial approach.
- **Consequences**: (+) RAG patterns work without a second store. (-) MSSQL and MySQL don't have native vector — must error clearly. (~) Migrations need to manage `CREATE EXTENSION vector` for Postgres and vector indexing policies for Cosmos.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/core` (Vector type + EF.functions surface), `@ts-linq/query` (function call AST), `@ts-linq/sql-visitor` (function translator), `@ts-linq/dialect-cosmos`, `@ts-linq/dialect-postgres` (pgvector).
- **New types / files**:
  - `packages/core/src/vector/vector.ts` — Float32Array alias + helpers
  - `packages/core/src/vector/ef-functions.ts` — `vectorDistance`, `fullTextContains`
  - `packages/sql-visitor/src/vector-function-translator.ts`
  - `packages/dialect-cosmos/src/vector-emitter.ts`
  - `packages/dialect-postgres/src/pgvector-emitter.ts`
  - `packages/migrations/src/pgvector-extension.ts` (auto-emits `CREATE EXTENSION IF NOT EXISTS vector`)
- **Touch-points**: metadata column-type registration (`hasVectorDimensions`), function-translator registry (shared with spatial / hierarchy).
- **Data flow**: Column declared as `Vector(N)` → metadata records vector(N) → on write, Float32Array is serialized (Cosmos: JSON array; PG: `'[..]'::vector` literal) → on query, `orderBy(vectorDistance)` translates to dialect SQL with native operator/function.

## 5. Implementation options

### Option A — Shared `Vector` + dialect emitters (Cosmos + pgvector)
- Pros: Portable code; matches EF Core API.
- Cons: Two dialect implementations.
- Effort: L

### Option B — Cosmos-only first, pgvector follow-up
- Pros: Smaller initial PR.
- Cons: Postgres users (the majority) wait; UX feels Cosmos-specific.

### Recommendation
Option A — pgvector is the more common deployment and shipping both is what gives the feature credibility.

## 6. Related problems / follow-up tasks

- `[P2-37](./P2-37-cosmos-provider.md)` — hard dependency for the Cosmos path.
- `[P2-34](./P2-34-spatial-types.md)` — shares the function-translator registration pattern.

## 7. Acceptance criteria

- [ ] Public API mirrors `vectorDistance` and `fullTextContains`
- [ ] Unit tests cover translation for all three distance metrics
- [ ] Integration test on Cosmos emulator with vector indexing policy
- [ ] Integration test on Postgres with `pgvector` extension
- [ ] Migrations auto-create pgvector extension when a vector column is declared
- [ ] Clear error on MSSQL / MySQL dialects
- [ ] Docs in `apps/docs/` updated with RAG worked example
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
