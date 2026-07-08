# docs.md — changes outside `packages/transformer-morph`

This file documents **every change made outside this package** while introducing
`@ts-linq/transformer-morph` — the ts-patch-free replacement for `@ts-linq/transformer`
built on ts-morph + the TypeScript Compiler API (feature branch `feature/transformer-morph`).

## 1. Root `package.json` — `morph:compile:examples` script

**What changed.** One script added next to the existing ts-patch pair:

```jsonc
"ts-patch:compile:examples": "tspc -p packages/examples/tsconfig.json",
"morph:compile:examples":    "node packages/transformer-morph/bin/ts-linq-transform.cjs build -p packages/examples/tsconfig.json",
```

**Why.** Parity demonstration: the same examples project compiles through the new
ts-patch-free pipeline. The ts-patch `"plugins"` entry inside
`packages/examples/tsconfig.json` is ignored by the new CLI (it is a language-service /
ts-patch concern), so the examples tsconfig required **no** changes.

## 2. Versioning artifacts (Changesets workflow)

Per the repo's local-versioning policy (`pnpm changeset` + `pnpm changeset version` before
PR), this branch also touches:

- `.changeset/` — one changeset for `@ts-linq/transformer-morph` created and then consumed
  by `changeset version` (no unconsumed `.changeset/*.md` remain).
- `packages/transformer-morph/package.json` + `CHANGELOG.md` — initial version 0.1.0 of the
  new package, produced by that `changeset version` run (in-package effect of the workflow,
  listed for completeness).
- `pnpm-lock.yaml` — new workspace package + its single new external dependency
  `ts-morph@^22.0.0` (chosen because ts-morph 22 bundles TypeScript 5.4.x, matching the
  workspace `typescript` peer range `^5.4.5`; see the invariant in this package's
  CLAUDE.md).

## 3. Explicitly **not** changed

- **`packages/transformer/**` — zero changes.** Per the review decision, the legacy
  ts-patch package stays byte-identical to `main`; its rewrite logic was **copied** (not
  moved, not wrapped) into this package's `src/core`. The only omission in the copy is
  `extractSinkFromCtx` (reads the `DiagnosticSink` from a ts-patch-augmented
  `TransformationContext` — meaningless without ts-patch).
  **Known, accepted duplication:** until the legacy package is deprecated, a rewrite-logic
  bugfix in either package must be evaluated for the other. This rule is recorded only in
  this package's CLAUDE.md — the legacy package was deliberately left untouched.
- `packages/examples/tsconfig.json` — still carries the ts-patch plugin entry; both
  pipelines (`ts-patch:compile:examples` and `morph:compile:examples`) work off the same
  config.
- `packages/query` / runtime packages — the emitted call shapes (`whereCompiled`,
  `havingCompiled`, `selectCompiled`, compiled query filters) are byte-compatible with the
  legacy transformer, so no runtime change is needed.
- `turbo.json`, `pnpm-workspace.yaml`, root `tsconfig.json`, jest configs — the new package
  is picked up by the existing `packages/*` globs and root jest `roots`; no config changes
  were required.
