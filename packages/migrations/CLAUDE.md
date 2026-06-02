# CLAUDE.md — @ts-linq/migrations

## Role

Schema **diffing, migration running, code generation, and DB-first scaffolding**. Consumed by
`orm` and the `cli`.

## Hard boundaries

- Depends on `core`, `metadata`, `types`, `esbuild`.
- Must **not** depend on `orm` or providers; it works against the `Dialect`/provider contracts.

## Critical invariants & known hazards

- **SQL generation is the #1 risk here.** DDL builders, seed emitters, and bundle/script code-gen
  interpolate identifiers and literals into raw SQL. All identifier/literal quoting must go through
  a single injection-safe quoting layer (refactor `task-1`, P0); generated bundles/scripts must be
  safe too (refactor `task-3`, P0).
- **`MigrationRunner` is a god class** — decompose into runner/history/step-planner collaborators
  (refactor `task-2`, P0). The repo already has `services/StepPlanner` + `SchemaInspectionService`;
  push logic there.
- Migrations must be **idempotent** where the emitter claims to be (`idempotent-emitter`); verify
  re-run safety.
- Migration history/tracking must be transactional — a partially applied migration must not be
  recorded as complete.

## Public API surface & stability

- `.` and `./scaffold` are the two entrypoints. `scaffoldDbContext` is consumed by the CLI.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/migrations/` (3× P0): injection-safe quoting,
decompose `MigrationRunner`, safe bundle/script code-gen.

## Validation

```bash
pnpm --filter @ts-linq/migrations typecheck
pnpm --filter @ts-linq/migrations lint
pnpm --filter @ts-linq/migrations build
```

## Do / Don't

- **Do** route every identifier/literal through the central quoting layer.
- **Do** keep history updates transactional and emitters idempotent.
- **Don't** interpolate user/model strings straight into DDL or generated code.
- **Don't** add more responsibilities to `MigrationRunner`.
