# sql-visitor/task-1: visitor contract + dispatch registry (COMPLETED)

Branch: `audit-refactor/sql-visitor-dispatch-registry`. Changeset: **major** for `@ts-linq/sql-visitor`.

## What changed
- New `packages/sql-visitor/src/visitContext.ts`:
  - `VisitContext` = `{ inputParameters, resolver?, converterResolver?, state, recurse(node) }` — one cohesive context replacing the old divergent positional params.
  - `NodeVisitor<N extends ExpressionNode = ExpressionNode>` = `{ visit(node: N, ctx): ConditionFragment }`.
  - `ColumnResolver`/`ConverterResolver` type defs **moved here** from `visitors/BinaryVisitor.ts` (broke a would-be import cycle). `BinaryVisitor.ts` re-exports them for path stability.
- All sub-visitors migrated to uniform `visit(node, ctx)` and `implements NodeVisitor<N>`:
  Binary, Logical, Unary, In, Method, EfFunction, JsonPath, Spatial, Hierarchy.
  - `MethodVisitor` delegates to spatial/hierarchy by passing the same `ctx`.
  - Removed the `state = new ParameterState(Question)` positional defaults (the silent-fallback hazard task-2 references).
- `NullVisitor` **unified**: single `visit(node: IsNullNode | IsNotNullNode, ctx)` branching on `node.type`. Old `visitIsNull`/`visitIsNotNull` methods **removed**. Registered under both `'isNull'` and `'isNotNull'` keys.
- `SqlVisitor` (`SqlVisitor.ts`): switch replaced by `private readonly registry = new Map<ExpressionNode['type'], NodeVisitor>()`. Typed `register<N>(type: N['type'], v: NodeVisitor<N>)` helper casts to `NodeVisitor` for the heterogeneous map (mirrors transformer's `as VisitorFn`). `toSql` builds the ctx once with `recurse: (n) => this._visit(n, ctx)`; `_visit` = lookup + miss → `AstSqlGenerationError('UNSUPPORTED_NODE_TYPE')`.
  - Always registered: binary, logical, not, isNull, isNotNull, in, method.
  - Always: an `unsupported` throwing-stub (preserves `Unsupported expression in WHERE clause: <desc>` message).
  - Conditional: `efFunction`/`jsonPath` register the real visitor when the translator is configured, else a module-level throwing-stub (`EF_FUNCTION_NOT_CONFIGURED` / `JSON_PATH_NOT_CONFIGURED`) with the exact former "requires a translator" messages/details.
- `index.ts`: now exports `NodeVisitor`, `VisitContext` (types) alongside `ColumnResolver`/`ConverterResolver` (re-pointed to `./visitContext`).

## API status
- `SqlVisitor` facade (`toSql`, ctor, `SqlVisitorOptions`) UNCHANGED.
- Exported sub-visitor `visit` signatures CHANGED → breaking → `major`. No external callers exist (dialects/query use only the facade + ports; the matching `BinaryVisitor` etc. in `transformer` are unrelated). Only in-package tests called them directly.

## Tests
- Migrated 5 test files that called sub-visitors positionally (Visitors, converter-lifting, EfFunctionVisitor, SpatialVisitor, HierarchyVisitor) via new helper `tests/helpers/makeCtx.ts` — assertions unchanged.
- New `tests/dispatch-registry.test.ts`: golden corpus (byte-identical SQL+params per node type) + registry routing (unknown type throws; unsupported sentinel; ef/json configured-vs-not contract).

## Validation (all green)
typecheck 32 ✓; lint 33 ✓ (pre-existing warnings only); build 32 ✓; arch:deps/cycles/dead ✓; unit 3040 ✓; integration 464 pass/2 skip ✓; e2e 290 ✓.

## Coordination / follow-ups
- **task-2** (param-state numbering): `VisitContext.state` is now the single shared `ParameterState` — directly unblocks task-2; the positional-default hazard is already removed.
- **query/task-4**: related (wires `SqlVisitorOptions`); the facade contract it depends on is unchanged.
- **task-4** (hide internal visitors from barrel) still pending — would let future signature changes be non-breaking.
- Spatial/Hierarchy remain delegates of `MethodVisitor` (no dedicated node type), intentionally not registry keys.
