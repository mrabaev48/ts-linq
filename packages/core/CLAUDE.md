# CLAUDE.md — @ts-linq/core

## Role

The **core runtime**: abstract `DatabaseProvider`, mapping decorators, relationship loading,
batching, interceptors, DDL, and resilience/health. Providers extend it; `query` and `orm` build
on it.

## Hard boundaries

- May depend on `@ts-linq/types`, `@ts-linq/metadata`, `@ts-linq/metrics-safe`, `@ts-linq/ast`.
- Must **not** depend on `query`, `orm`, dialects, or providers (those depend on core).

## Critical invariants & known hazards

- **SQL injection risk in `loading/RelationshipLoader`** — junction/relationship reads have built
  raw, unescaped SQL via string interpolation. Always go through parameterization + dialect
  identifier quoting (refactor `task-4`, P0).
- **No silent catches on execution/loading paths.** Several `catch {}` blocks swallow errors that
  affect correctness (refactor `task-5`, P0). Surface typed errors with context.
- **`DatabaseProvider` is a god class (~1005 LOC).** When extending, prefer adding a focused
  collaborator over piling more onto the base (refactor `task-1`, P0).
- **Don't reach into the `MetadataStorage` global singleton** from the loading layer — it breaks
  per-context isolation (refactor `task-2`, P0). Use an injected registry/read-port.
- Retry policies in `utils/RetryPolicies` are a **stale duplicate** of `@ts-linq/concurrency` —
  consolidate, don't extend the copy.

## Public API surface & stability

- Public via `src/index.ts`. Note it re-exports several canonical types from `@ts-linq/types` for
  backward compatibility; keep those re-exports stable.
- The `DatabaseProvider` contract and interceptor interfaces are consumed by every provider —
  changes are breaking and must be validated across `provider-*`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/core/` (4× P0): decompose `DatabaseProvider`, break
the singleton coupling, kill the injection vector, eliminate silent catches.

## Validation

```bash
pnpm --filter @ts-linq/core typecheck
pnpm --filter @ts-linq/core lint
pnpm --filter @ts-linq/core build
```

After any provider-contract change run the `provider-*` and `orm` builds/tests too.

## Do / Don't

- **Do** parameterize all SQL and quote identifiers via the dialect.
- **Do** throw typed, contextful errors — never swallow.
- **Don't** grow `DatabaseProvider`; extract collaborators.
- **Don't** import from `query`/`orm`/dialects/providers.
