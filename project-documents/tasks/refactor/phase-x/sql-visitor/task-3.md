---
status: not-started
phase: phase-x
package: sql-visitor
priority: P2
effort: S
risk: medium
category: sql
depends_on: []
related: []
---

# Refactor: Fix `EfFunctionVisitor.resolveParam` binding a column name as a literal parameter

## Problem
`EfFunctionVisitor.resolveParam` (`packages/sql-visitor/src/visitors/EfFunctionVisitor.ts:132-150`)
handles a `PropertyNode` used in a value position by **rendering the property name to a
string and binding that string as a SQL parameter**:

```ts
// Property node used as a value (rare but allowed)
return [placeholder, renderPropertyName(arg, undefined)];   // EfFunctionVisitor.ts:149
```

This is wrong on two counts:
1. It emits a placeholder (`?`/`$N`) and binds the **column name string** (e.g. `"price"`)
   as the parameter value — so `EF.functions.dateDiffDay(a.start, a.end)` would compare
   against the literal string `"end"`, not the `end` column.
2. It passes `resolver = undefined` to `renderPropertyName`, so even the (wrong) string is
   the **unresolved TypeScript property name**, not the DB column name.

A property used as a value should be **inlined as a column reference** (no placeholder, no
parameter), exactly as the variadic path already does
(`resolveVariadicArgs` `:162-163` correctly pushes `renderPropertyName(arg, resolver)` as a
SQL part, not a parameter).

## Evidence
- Bug line: `EfFunctionVisitor.ts:149`.
- Correct contrasting behavior in the same file: `resolveVariadicArgs` `:162-163`.
- `resolveCol` correctly inlines properties (`:111-130`); `resolveParam` is the inconsistent
  one.

## Why this is bad
- **Incorrect SQL / wrong results** for any EF function whose value argument is an entity
  property (two-column `dateDiffDay`/`dateDiffMonth`/`like` with a column RHS).
- **Inconsistent** with `resolveVariadicArgs`, which gets it right — a clear sign this is an
  oversight, not a deliberate design.
- Uses `resolver = undefined`, dropping `@Column({name})` mapping even for the wrong path.

## Target architecture
A property in a value position is a **column reference fragment**, never a bound parameter.
`resolveParam` should return a column-reference *part* (resolved via `resolver`) for property
nodes, and a placeholder+value pair only for literals/parameterRefs — matching
`resolveVariadicArgs`.

## Proposed refactor
1. Change `resolveParam`'s callers (`like`, `iLike`, `dateDiffDay`, `dateDiffMonth`) to
   accept either a placeholder+param or an inlined column reference, mirroring the variadic
   resolver.
2. For a `PropertyNode` argument, emit `renderPropertyName(arg, resolver)` directly into the
   condition with no parameter.
3. Add the `resolver` to the property render call (fix the `undefined` resolver).

## Suggested design patterns
- **Consistency / DRY** — converge `resolveParam` onto the already-correct
  `resolveVariadicArgs` logic (consider extracting one shared `renderArg(arg, ctx)` helper).

## Testing plan
- **Unit**: `EF.functions.dateDiffDay(a.start, a.end)` emits `... a.start, a.end ...` with
  **zero** bound parameters and resolved column names.
- **Unit**: `EF.functions.like(a.name, '%x%')` still binds the literal as a parameter.
- **Regression**: `EfFunctionVisitor.test.ts` green.

## Acceptance criteria
- [ ] Property-as-value arguments are inlined as resolved column references, not parameters.
- [ ] `resolver` is threaded (no `undefined`).
- [ ] Two-column EF function test added and passing.
- [ ] Existing EF function tests green.

## Refactor order
Independent; small correctness fix. Verify whether this path is reachable today (it requires
the EF visitor to be wired into the query pipeline — see `query/task-4.md`; the bug exists
regardless but is currently masked by that dead path).

## Notes
Correctness bug → `patch` changeset. Cross-reference `query/task-4.md`: until the EF visitor
is wired into `.where()`, this code is unreachable in production, but fixing it now prevents
a latent defect from shipping the moment task-4 lands.
