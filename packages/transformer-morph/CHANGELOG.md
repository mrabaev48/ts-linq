# @ts-linq/transformer-morph

## 0.1.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.11.0

## 0.1.0

### Minor Changes

- Initial release: ts-patch-free replacement for `@ts-linq/transformer` built on ts-morph
  (project model / analysis) + the TypeScript Compiler API (transform / emit). The full
  rewrite pipeline (rewriters, expression visitors, scope guards, diagnostics) is ported
  into `src/core` with byte-compatible emitted call shapes; no dependency on ts-patch or
  `@ts-linq/transformer`. Ships `TsLinqMorphProject` (`analyze` / `transformSources` /
  `writeTransformedSources` / `emit`), `DiagnosticCollector` + `formatDiagnostics`,
  `createTsLinqCustomTransformers`, `createWhereTransformer`, and the `ts-linq-transform`
  CLI (`build` / `check`) as a `tspc` replacement.
