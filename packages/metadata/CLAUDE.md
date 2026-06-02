# CLAUDE.md — @ts-linq/metadata

## Role

Owns the ORM **mapping model** and metadata registry. The single source of truth for entity →
table/column/key/relationship mapping, value conversion, property access, compiled models, and
stored-procedure mapping.

## Hard boundaries

- Depends only on `@ts-linq/types`.
- Must **not** depend on `core`, `query`, `orm`, dialects, or providers — they depend on this.

## Critical invariants

- **`MetadataStorage` is a process-global singleton.** Reaching into it directly from runtime data
  paths breaks multi-tenant / multi-context isolation. Prefer the `MetadataRegistry` instance and
  an explicit read-port; see refactor task below.
- `registerEntity` ordering and the pending-collector flush sequence are subtle — decorators
  register lazily and are resolved on first use. Don't assume eager registration.
- Value converters and comparers must stay paired: a converter that changes the stored
  representation needs a matching comparer for change tracking.

## ⚠️ Repo hygiene

- `src/` currently contains **committed build artifacts** (`*.d.ts` next to `*.ts`, e.g.
  `Column.d.ts`, `Entity.d.ts`, `index.d.ts`). These are generated output that should not be in
  source control (refactor `task-3`). Do not edit the `.d.ts` files by hand; edit the `.ts` source.

## Public API surface & stability

- Public via `src/index.ts`. The metadata descriptor shapes are consumed by many packages — treat
  shape changes as breaking.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/metadata/`:
- `task-3` (P0) — remove committed build artifacts from `src`.
- `task-1` / `task-2` — introduce a read-port and tame the `MetadataRegistry` god class (575 LOC).

## Validation

```bash
pnpm --filter @ts-linq/metadata typecheck
pnpm --filter @ts-linq/metadata lint
pnpm --filter @ts-linq/metadata build
```

## Do / Don't

- **Do** go through `MetadataRegistry` instances; treat the global singleton as legacy.
- **Do** keep converter + comparer in sync.
- **Don't** hand-edit `.d.ts` files in `src`.
- **Don't** add dependencies on higher-level packages.
