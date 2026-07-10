# CLAUDE.md — @ts-linq/transformer-morph

## Role

**ts-patch-free replacement for `@ts-linq/transformer`**: the full rewrite pipeline lives
in `src/core` (pure Compiler API, ported from the legacy package); ts-morph provides the
project model / analysis layer; the TypeScript Compiler API provides transform/emit.
Ships the `ts-linq-transform` CLI (a `tspc` replacement).

## Hard boundaries

- Depends on `@ts-linq/types`, `ts-morph`, and `typescript` (peer) — **nothing else**.
- Must **not** depend on `@ts-linq/transformer` (this package replaces it) nor on
  `query`/`orm`/`core`.
- `src/core/**` is pure Compiler API — **no ts-morph imports there, ever**.

## Critical invariants

- **Emitted call shapes are byte-compatible with `@ts-linq/transformer`**
  (`whereCompiled`/`havingCompiled`/`selectCompiled`/compiled query filters, brand-guarded
  scope detection, `TS_LINQ_DIAGNOSTIC_CODE` 90001). Runtime packages must not need changes.
- **Single compiler instance in the transform pipeline.** ts-morph bundles its own
  TypeScript; nothing from ts-morph (nodes, checker, program) may be passed into
  `createWhereTransformer`, `ts.transform` or `program.emit`. The ts-morph layer is for
  analysis/reporting only (`analyze()`, `getMorphProject()`).
- **ts-morph major must bundle the same TypeScript minor as the workspace `typescript`
  peer** (ts-morph 22 ⇄ TS 5.4.x). Bumping either requires bumping the other.
- `transformSources()` must preserve untouched statements byte-for-byte (statement-level
  splicing; full re-print only as defensive fallback).
- Only rewrite lambdas in sanctioned call positions (brand guards in `src/core/scope`).
  Transform-time problems flow through `DiagnosticSink`/`DiagnosticCollector` — never
  swallowed. Thrown errors extend `OrmError` (`ValidationError` for config problems).
- The legacy `@ts-linq/transformer` stays untouched in the repo while ts-patch pipelines
  exist. If a rewrite bug is fixed here, evaluate whether the legacy copy needs the same
  fix (tracked duplication — see docs.md).

## Public API surface & stability

`TsLinqMorphProject`, `DiagnosticCollector`, `formatDiagnostics`,
`createTsLinqCustomTransformers`, `createWhereTransformer`, `buildVisitor`,
`DiagnosticSink`, `TS_LINQ_DIAGNOSTIC_CODE`, `runCli`/`parseCliArgs`, and the
`ts-linq-transform` bin.

## Validation

```bash
pnpm --filter @ts-linq/transformer-morph typecheck
pnpm --filter @ts-linq/transformer-morph lint
pnpm --filter @ts-linq/transformer-morph build
npx jest -c ./jest.unit.config.js packages/transformer-morph
# real-project smoke test:
pnpm run morph:compile:examples
```

## Do / Don't

- **Do** keep the CLI exit-code contract: 0 ok, 1 compile/transform errors, 2 usage.
- **Do** route new pipeline variants through `createTsLinqCustomTransformers`.
- **Don't** mix ts-morph objects into the Compiler API pipeline.
- **Don't** re-import anything from `@ts-linq/transformer` — the core here is the
  replacement, not a wrapper.
