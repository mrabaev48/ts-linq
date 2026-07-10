# @ts-linq/transformer-morph

> ts-patch-free **replacement** for `@ts-linq/transformer`, built on **ts-morph**
> (project model / analysis) + the **TypeScript Compiler API** (transform / emit).

The ts-linq compile-time transformer rewrites `where(u => ...)`, `having(...)`, `select(...)`
and `hasQueryFilter(...)` lambdas into serializable AST nodes at build time. The legacy
wiring (`@ts-linq/transformer`) runs inside `tsc` via **ts-patch**, which requires patching
the TypeScript installation. This package supersedes it: the full rewrite pipeline
(rewriters, expression conversion, scope guards, diagnostics) is ported into `src/core`,
and no ts-patch — and no dependency on `@ts-linq/transformer` — is needed. The emitted call
shapes (`whereCompiled` / `havingCompiled` / `selectCompiled` / compiled query filters) are
byte-compatible with the legacy transformer, so the runtime packages work unchanged.

## Architecture

Two cooperating layers, each used strictly for what it is best at:

| Layer | Library | Responsibility |
|---|---|---|
| Project model / analysis | ts-morph | tsconfig loading for analysis, type-aware call-site scanning (`analyze()`), codemod surface (`getMorphProject()`) |
| Transform / emit | TypeScript Compiler API | `ts.Program` + `program.emit(..., customTransformers)` / `ts.transform` driving the `src/core` rewrite pipeline |

ts-morph bundles its own TypeScript compiler, so no ts-morph object ever crosses into the
transform pipeline — the nodes, the TypeChecker and the transformer all come from the single
workspace `typescript` instance. That removes the classic mixed-compiler-instance hazard.

`src/core` is a faithful port of the `@ts-linq/transformer` pipeline (scope guards by type
brand, `DiagnosticSink` with `TS_LINQ_DIAGNOSTIC_CODE` 90001, chained-receiver re-rewrite).
The legacy package remains in the repo untouched for existing ts-patch pipelines, but new
integrations should use this package.

## CLI — `ts-linq-transform`

```bash
# Type-check, transform and emit (drop-in replacement for `tspc -p tsconfig.json`):
ts-linq-transform build -p tsconfig.json

# Dry run: apply the transformer in-memory and report diagnostics, no emit:
ts-linq-transform check -p tsconfig.json

# List every where/having/select/hasQueryFilter call site and whether it will be rewritten:
ts-linq-transform check -p tsconfig.json --list
```

Exit codes: `0` success, `1` compile/transform errors, `2` bad CLI usage.
No `"plugins"` entry in `tsconfig.json` is required (an existing ts-patch entry is ignored).

## Programmatic API

```ts
import { TsLinqMorphProject } from '@ts-linq/transformer-morph';

const project = new TsLinqMorphProject({ tsConfigFilePath: './tsconfig.json' });

// tspc-style build:
const { emitSkipped, transformDiagnostics, emitDiagnostics } = project.emit();

// Source-to-source (bundler pipelines): transformed .ts text per file.
const { files, diagnostics } = project.transformSources();

// Mirror the transformed source tree for a bundler to consume:
project.writeTransformedSources({ outDir: './.ts-linq/src' });

// Reporting: every candidate call site + whether its receiver carries the type brand.
for (const c of project.analyze()) {
  console.log(`${c.filePath}:${c.line}:${c.column} .${c.methodName}() branded=${c.receiverIsBranded}`);
}
```

For build pipelines that already own a `ts.Program` (webpack `ts-loader`, rollup TS plugins):

```ts
import { createTsLinqCustomTransformers, DiagnosticCollector } from '@ts-linq/transformer-morph';

const sink = new DiagnosticCollector();
const customTransformers = createTsLinqCustomTransformers(program, sink);
// pass `customTransformers` to your pipeline; inspect sink.diagnostics afterwards
```

The lowest-level entrypoint `createWhereTransformer(program, sink)` (a plain
`ts.TransformerFactory<ts.SourceFile>`) is also exported.

### Formatting guarantees of `transformSources()`

Unchanged files are returned byte-for-byte. In changed files, only the top-level statements
that actually contain a rewrite are re-printed; everything else (comments, blank lines,
formatting) is preserved.

## What lives here

- **`src/core/`** — the rewrite pipeline (ported from `@ts-linq/transformer`):
  `createWhereTransformer`, `buildVisitor`, rewriters (`where`/`having`/`select`/
  `hasQueryFilter`), expression visitors, scope guards, node builders, `DiagnosticSink`.
- **`TsLinqMorphProject`** — project host: `analyze()`, `transformSources()`,
  `writeTransformedSources()`, `emit()`, `getPreEmitDiagnostics()`.
- **`DiagnosticCollector` / `formatDiagnostics`** — explicit `DiagnosticSink` + `tsc`-style
  rendering.
- **`createTsLinqCustomTransformers`** — minimal `ts.CustomTransformers` integration surface.
- **`runCli` / `parseCliArgs`** — the `ts-linq-transform` CLI.

## Dependencies

- `@ts-linq/types` (error hierarchy)
- `ts-morph` `^22` (bundles TS 5.4.x — matches the workspace `typescript` peer `^5.4.5`)
- `typescript` (peer)

No dependency on `@ts-linq/transformer` or ts-patch.

## License

Part of the ts-linq monorepo. See the repository root for license details.
