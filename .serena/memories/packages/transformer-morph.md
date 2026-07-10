# @ts-linq/transformer-morph — ts-patch-free replacement for @ts-linq/transformer

**Status:** branch `feature/transformer-morph` (commit cd63f6a1), version 0.1.0. PR not yet opened at the time of writing.

## Purpose & architecture

Replaces the ts-patch-based `@ts-linq/transformer` wiring: same compile-time lambda rewriting
(`where`/`having`/`select`/`hasQueryFilter` → `*Compiled` calls) without patching the TypeScript
install and **without depending on the legacy package**.

Two layers (hard invariant — never mix them):
- **ts-morph ^22** (bundles TS 5.4.x, must match workspace `typescript` peer ^5.4.5): project
  model / analysis only — `TsLinqMorphProject.analyze()` (brand-aware call-site scan),
  `getMorphProject()` codemod surface. No ts-morph object ever enters the transform pipeline.
- **TypeScript Compiler API** (workspace `typescript`): `ts.Program` built via
  `ts.getParsedCommandLineOfConfigFile` drives `transformSources()` (in-memory; statement-level
  splicing preserves untouched formatting byte-for-byte), `writeTransformedSources({outDir|overwrite})`,
  and `emit()` (`program.emit` + customTransformers — tspc replacement).

## Rewrite core: `src/core/**`

Full **copy** (user decision: legacy package deliberately untouched, temporary duplication accepted)
of `packages/transformer/src` pipeline: CallRewriteVisitor (buildVisitor + DISPATCH), rewriters,
expression visitors (+calls/), scope guards (`__tsLinqWhereTransformerBrand`,
`__tsLinqEntityTypeBuilderBrand`), nodes builders, DiagnosticSink (TS_LINQ_DIAGNOSTIC_CODE 90001).
Only omission: `extractSinkFromCtx` (ts-patch-specific). Emitted call shapes byte-compatible.
**Rule: a rewrite-logic bugfix in either package must be evaluated for the other** (recorded in the
package CLAUDE.md and docs.md). `src/core` is pure Compiler API — no ts-morph imports allowed.
Core does NOT import `@ts-linq/ast` (emits AST literals), so deps are only `@ts-linq/types` + `ts-morph`.

## Public API / CLI

`TsLinqMorphProject`, `DiagnosticCollector`/`formatDiagnostics`, `createTsLinqCustomTransformers`,
`createWhereTransformer`, `buildVisitor`, `runCli`/`parseCliArgs`; bin `ts-linq-transform`
(`build` = tspc replacement, `check [--list]` = dry run; exit codes 0/1/2). Config errors →
`ValidationError` from @ts-linq/types.

## Footprint outside the package (see packages/transformer-morph/docs.md)

Root package.json: `morph:compile:examples` script (parity with `ts-patch:compile:examples`,
same examples tsconfig — its ts-patch "plugins" entry is ignored by the new CLI).
pnpm-lock.yaml: ts-morph. `packages/transformer/**` byte-identical to main.

## Tests & validation

`tests-new/`: 21 suites / 147 tests — 20 host/CLI (fixture temp projects with the query shim)
+ 127 ported from the legacy transformer suite (`tests-new/core/**`, only import paths rewritten;
extractSinkFromCtx tests dropped). Validated: build/typecheck/lint, arch:deps/cycles/dead,
test:all (unit 4165 / integration 461 / e2e 290), `pnpm run morph:compile:examples` smoke.
