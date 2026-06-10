---
status: completed
phase: phase-x
package: query
priority: P0
effort: L
risk: high
category: sql
depends_on: []
related: ["sql-visitor/task-1.md", "query/task-6.md"]
---

# Refactor: Wire the full `SqlVisitorOptions` feature surface into the `.where()/.having()` runtime path

## Problem
`SqlVisitor` exposes a rich `SqlVisitorOptions` surface — `converterResolver`,
`spatialTranslator`, `hierarchyTranslator`, `efFunctionTranslator`, `userFunctions`,
`jsonPathTranslator`, `jsonAccessRewriter`, `complexAccessRewriter`
(`packages/sql-visitor/src/SqlVisitor.ts:30-45`). **None of it is wired into the runtime
query pipeline.** Every production instantiation is a bare `new SqlVisitor()` with no
options and the default `ParameterStyle.Question`:

- `Queryable.whereCompiled` → `new SqlVisitor()` (`Queryable.ts:644`).
- `Queryable.havingCompiled` → `new SqlVisitor()` (`Queryable.ts:948`).
- `GlobalFilterApplier.apply` → `new SqlVisitor()` (`GlobalFilterApplier.ts:54`).

A repo-wide grep confirms these are the **only** three production call sites; no dialect or
provider ever constructs a `SqlVisitor` with options.

### Consequences
- **Value converters are silently ignored in WHERE/HAVING.** A `@Column` with
  `HasConversion` works on read/write but a predicate like
  `.where(u => u.status === Status.Active)` compares the *unconverted* literal against the
  *converted* column — wrong results, no error. The converter-lifting logic in
  `BinaryVisitor.liftNode` (`packages/sql-visitor/src/visitors/BinaryVisitor.ts:47-66`)
  is dead in production.
- **Spatial / HierarchyId methods throw** in `.where()` because `MethodVisitor` has no
  translator (`MethodVisitor.ts:22-42` throws `UNSUPPORTED_METHOD`), even though the
  feature exists and is tested in isolation.
- **JSON path / complex-type / EF.functions predicates throw** for the same reason
  (`SqlVisitor.ts:143-160` throws when the translator is absent;
  `CallVisitor` happily *emits* `efFunction` AST nodes that can never be rendered).

## Evidence
- `grep -rn "new SqlVisitor(" packages/*/src` → exactly 3 hits, all bare, all in `query`.
- `grep -rn "converterResolver|spatialTranslator|jsonPathTranslator|efFunctionTranslator"
  packages/*/src` (excluding `sql-visitor/src`) → only the 3 bare-constructor sites; no
  options are ever passed.
- `Queryable.buildColumnResolver` exists (`Queryable.ts:1490-1511`) but no analogous
  `buildConverterResolver` / translator wiring exists.

## Why this is bad
- **Feature dead on arrival in the hot path**: converters, spatial, JSON, complex types and
  EF.functions are advertised, unit-tested, and exported, but unusable through the primary
  `.where()` API — a severe behavior/type-level vs runtime mismatch.
- **Silent wrong results** (converters) are worse than a thrown error.
- **DIP gap**: `Queryable` knows the dialect (it builds a `ColumnResolver`) but never asks
  the provider/dialect/metadata for the translators the visitor needs.

## Target architecture
Centralize `SqlVisitor` construction behind a single injected factory that assembles the
full `SqlVisitorOptions` from provider + metadata:

- `SqlVisitorFactory` (or method on `QueryContext`) produces a configured `SqlVisitor`
  using: dialect-provided `spatialTranslator`/`hierarchyTranslator`/`jsonPathTranslator`/
  `efFunctionTranslator`, metadata-derived `converterResolver` (property → converter),
  and any `jsonAccessRewriter`/`complexAccessRewriter` from metadata.
- `whereCompiled`, `havingCompiled` and `GlobalFilterApplier` all obtain their visitor from
  this factory instead of `new SqlVisitor()`.

This is **Dependency Inversion**: the visitor's collaborators are injected from the
composition root (provider/dialect + metadata) rather than defaulted to nothing.

## Proposed refactor
1. Add `buildConverterResolver()` on `Queryable`/`QueryContext` mirroring
   `buildColumnResolver()` (`Queryable.ts:1490`), sourcing converters from
   `MetadataStorage` column metadata.
2. Expose translator getters on `DatabaseProvider`/`SqlDialect` (cross-package — coordinate
   with the dialect cluster) and thread them through `QueryContext`.
3. Introduce `SqlVisitorFactory.create(context, resolver)` returning a fully-configured
   `SqlVisitor`; replace all three bare `new SqlVisitor()` sites.
4. Add integration coverage proving converter lifting / spatial / JSON predicates work
   end-to-end through `.where()`.

## Suggested design patterns
- **Abstract Factory** (`SqlVisitorFactory`) — *Why*: one place assembles the visitor's
  full collaborator set, killing the bare-constructor anti-pattern permanently.
- **Dependency Injection** — *Why*: translators/converters flow from the composition root,
  not hard-coded defaults.

## Testing plan
- **Integration/contract**: `.where(u => u.status === X)` with a registered converter emits
  the converted literal (regression for the silent-wrong-results bug).
- **Integration**: spatial/JSON/EF.functions predicate compiles to SQL instead of throwing.
- **Unit**: `SqlVisitorFactory` produces options matching provider + metadata.

## Acceptance criteria
- [ ] No bare `new SqlVisitor()` remains in `packages/query/src`.
- [ ] Converter lifting verified end-to-end in a `.where()` integration test.
- [ ] Spatial / JSON / EF.functions predicates resolve through `.where()` (no spurious throw).
- [ ] `GlobalFilterApplier` uses the same configured visitor.
- [ ] All existing tests green.

## Refactor order
Coordinate with `sql-visitor/task-1.md` (translator injection contracts). Can land after
`query/task-3.md` (QueryContext) which is the natural home for the factory.

## Notes
Verify with the metadata/dialect cluster owners which translators already exist
(spatial/hierarchy/json translators are referenced in `@ts-linq/types`). This is the
highest-impact *correctness* finding in the query package.
