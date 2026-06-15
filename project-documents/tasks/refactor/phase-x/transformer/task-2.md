---
status: completed
phase: phase-x
package: transformer
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Make diagnostic messages method-aware (stop hardcoding "where()")

## Problem
`makeUnsupported` in `packages/transformer/src/nodes/builders.ts:70-85` hardcodes the method
name `where()` in every "unsupported expression" diagnostic:

```ts
const message =
  `where() predicate contains unsupported expression: ${name}. ` + SUPPORTED_SUMMARY;
```

But the transformer rewrites **four** methods — `where`, `having`, `select`, `hasQueryFilter`
(`index.ts:19`). When an unsupported expression appears inside a `.having(...)` or
`hasQueryFilter(...)` predicate, the developer is told it's a `where()` problem, which is
misleading.

The `TransformContext` already carries the correct `methodName`
(`TransformContext.ts:8`) and `BinaryVisitor` uses it correctly
(`expression/visitors/BinaryVisitor.ts:55` → `${tctx.methodName}() predicate: ...`), so the
fix is to thread `methodName` into `makeUnsupported` too.

## Evidence
- Hardcoded `where()`: `builders.ts:74`.
- `makeUnsupported` callers that *have* a `tctx` (and thus `methodName`) but don't pass it:
  `CallVisitor.ts:38, 47, 70, 79, 104, 155, 216`; `transformExpression.ts:14, 26`;
  `ExpressionDispatcher.ts:34`.
- Correct method-aware messaging precedent: `BinaryVisitor.ts:55`.

## Why this is bad
- **Misleading diagnostics**: developers debugging a `having`/`select`/`hasQueryFilter`
  predicate are pointed at the wrong method.
- **Inconsistency**: one visitor is method-aware, the central helper is not.

## Target architecture
`makeUnsupported` should accept the method name (or the full `tctx`) and interpolate it, so
all diagnostics name the actual method. Keep the `DiagnosticSink`-optional behavior.

## Proposed refactor
1. Change `makeUnsupported(node, sink?)` →
   `makeUnsupported(node, ctx?: { sink?; methodName? })` (or add an explicit `methodName`
   param), defaulting to a generic "predicate" when absent.
2. Update call sites that have a `tctx` to pass `{ sink: tctx.sink, methodName: tctx.methodName }`.
3. Keep the `SUPPORTED_SUMMARY` text.

## Suggested design patterns
- **Context propagation / DRY** — *Why*: one message template, correct method name from the
  single source of truth (`TransformContext.methodName`).

## Testing plan
- **Unit**: an unsupported expr inside `having(...)` yields a message starting with
  `having()`, not `where()`.
- **Regression**: `WhereTransformer.test.ts` and visitor tests green (where()-named messages
  still correct for where()).

## Acceptance criteria
- [ ] `makeUnsupported` interpolates the actual method name.
- [ ] No hardcoded `where()` in `builders.ts` diagnostics.
- [ ] Diagnostic-text test for `having`/`select` added.
- [ ] Existing tests green.

## Refactor order
Independent; trivial. Pairs naturally with `transformer/task-1.md` (touches the same call
sites).

## Notes
Compile-time diagnostics only — no runtime/public API change.
