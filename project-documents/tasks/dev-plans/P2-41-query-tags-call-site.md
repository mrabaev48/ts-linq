---
title: Query Tags and Call-Site Tagging
ef_core_api: IQueryable<T>.TagWith("name") / IQueryable<T>.TagWithCallSite()
status: not-started
priority: P2
effort: S
depends_on: []
related: [P2-45-logging-diagnostics.md]
ts_linq_packages_touched: [@ts-linq/query, @ts-linq/sql-visitor, @ts-linq/telemetry]
---

# Query Tags and Call-Site Tagging

## 1. Why (problem statement)

EF Core's `TagWith` injects a SQL comment in front of the emitted statement so the same query can be identified in DBA tools, query stores, and slow-query logs. `TagWithCallSite` (EF8) extends this by auto-injecting the file + line of the call. `ts-linq` has no such mechanism, making correlation between application code and DB query telemetry painful. The feature is cheap to add and pays back immediately in operability.

## 2. EF Core reference syntax (must be preserved verbatim)

```csharp
var hot = ctx.Orders
    .TagWith("dashboard-top-orders")
    .TagWithCallSite()
    .Where(o => o.Status == "OPEN")
    .ToList();

// Emitted SQL:
// -- dashboard-top-orders
// -- File: OrdersController.cs:42
// SELECT ...
```

TypeScript shape that `ts-linq` must mirror (signatures only, no implementation):

```ts
const hot = ctx.orders
  .tagWith('dashboard-top-orders')
  .tagWithCallSite()
  .where(o => o.status === 'OPEN')
  .toArray();

// Emitted SQL:
// -- dashboard-top-orders
// -- File: orders-controller.ts:42
// SELECT ...
```

> Hard rule: the public TypeScript names, chaining order, and semantics MUST match EF Core. Internal implementation is free to deviate.

## 3. Architecture Decision Record (ADR)

```mermaid
flowchart LR
  A[Queryable.tagWith] --> B[Append to query AST tags[]]
  C[Queryable.tagWithCallSite] --> D[Capture Error().stack frame]
  D --> B
  B --> E[SQL visitor]
  E --> F[Prepend -- comments before SQL]
  F --> G[(Database / Query Store)]
  F --> H[Telemetry: include tags in span attrs]
```

- **Decision**: Store tags as an ordered string list on the query expression; SQL visitor emits each tag as a leading `--` comment line.
- **Context**: Tags are non-semantic; storing them on the AST keeps them composable with chained operators.
- **Consequences**: (+) Trivial implementation. (-) Multi-line tags must be sanitized to avoid SQL injection via comment-break sequences. (~) Call-site capture relies on `Error().stack` parsing which is V8-specific but reliable in Node.

## 4. Technical & architectural description

- **Affected packages**: `@ts-linq/query` (AST tag list), `@ts-linq/sql-visitor` (emit comments), `@ts-linq/telemetry` (include tags as span attributes).
- **New types / files**:
  - `packages/query/src/ast/query-tags.ts` — tag list type
  - `packages/query/src/tag-with.ts`, `packages/query/src/tag-with-call-site.ts`
  - `packages/sql-visitor/src/emit-tags.ts`
  - `packages/telemetry/src/tag-span-attributes.ts`
- **Touch-points**: `Queryable` interface extensions; emit hook at top of every translated statement.
- **Data flow**: Method call → push tag onto AST → visitor reads tag list when emitting SELECT/UPDATE/etc → telemetry layer reads same tag list and adds to OTEL span.

## 5. Implementation options

### Option A — Tags on AST, comments emitted by visitor
- Pros: Composable; available to telemetry as well.
- Cons: Visitor must sanitize.
- Effort: S

### Option B — Out-of-band map (query hash → tags)
- Pros: Zero AST change.
- Cons: Cache invalidation hell; doesn't survive query composition.

### Recommendation
Option A.

## 6. Related problems / follow-up tasks

- `[P2-45](./P2-45-logging-diagnostics.md)` — tags must flow into the LogTo sink as part of the structured event.

## 7. Acceptance criteria

- [ ] Public API mirrors `tagWith` / `tagWithCallSite`
- [ ] Unit tests cover comment emission, multi-tag ordering, sanitization (newlines + `*/` rejected)
- [ ] Integration test confirms tags visible in `pg_stat_statements` (or equivalent)
- [ ] Telemetry spans include tags
- [ ] Docs in `apps/docs/` updated
- [ ] No regressions in `pnpm typecheck`, `pnpm arch:deps`, `pnpm arch:cycles`, `pnpm arch:dead`

## 8. Pre-PR sweep (mandatory)

Before opening the PR for this task:

1. Re-read every `dev-plans/*.md` whose `status != done`.
2. For each, decide whether assumptions changed because of this task. If yes — update the affected sections (especially **Implementation options**, **depends_on**, **ts_linq_packages_touched**).
3. Record sweep results in the PR description under `## Cross-task sweep` with the bullet list:
   - `P?-??` — no change / updated section X / status moved to `blocked` because Y
4. Only after the sweep is recorded, open the PR.
