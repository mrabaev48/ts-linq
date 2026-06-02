---
status: not-started
phase: phase-x
package: sql-visitor
priority: P1
effort: S
risk: medium
category: sql
depends_on: []
related: ["sql-visitor/task-1.md"]
---

# Refactor: Remove the per-visitor default `ParameterState` fallback (placeholder-numbering hazard)

## Problem
Every parameter-emitting sub-visitor declares a **default** `ParameterState` argument:
`state: ParameterState = new ParameterState(ParameterStyle.Question)`. If any caller forgets
to thread the *shared* `ParameterState`, the visitor silently constructs a **fresh counter
starting at 1**, producing duplicate/incorrect positional placeholders (`$1`, `$1`, …) that
corrupt parameter binding — with no error.

### Sites with the dangerous default
- `BinaryVisitor.visit` — `state: ParameterState = new ParameterState(ParameterStyle.Question)`
  (`visitors/BinaryVisitor.ts:26`).
- `InVisitor.visit` (`visitors/InVisitor.ts:14`).
- `MethodVisitor.visit` (`MethodVisitor.ts:21`).
- `EfFunctionVisitor.visit` (`EfFunctionVisitor.ts:20`).

`SqlVisitor.toSql` correctly creates one `state` and threads it (`SqlVisitor.ts:105-110`),
so today the defaults are never hit *from `SqlVisitor`* — but the visitors are **exported
from the package barrel** (`index.ts:9-19`) and can be called directly (e.g. the
`converter-lifting.test.ts` / `Visitors.test.ts` construct visitors standalone), where the
default *would* silently mis-number.

## Evidence
- Default-arg sites: lines listed above (current).
- Visitors exported publicly: `packages/sql-visitor/src/index.ts:8-19`.
- The default is for `Question` style only — for `Positional`/`Named`, a stray fresh state
  would emit `$1`/`@p1` collisions across fragments.

## Why this is bad
- **Silent placeholder corruption**: the failure mode is wrong query results / parameter
  mismatch, not an exception — extremely hard to debug.
- **Encourages misuse**: the default makes `state` look optional when it is load-bearing for
  correctness across a multi-fragment WHERE.
- **Couples visitors to a specific style** (`Question`) as the implicit fallback.

## Target architecture
`ParameterState` must be a **required, shared** collaborator (it owns the monotonically
increasing counter for the whole predicate). With `sql-visitor/task-1.md`'s `VisitContext`
this is natural — `state` lives on the context and is never defaulted. Until then, make the
parameter required (remove the default) so the type system forces correct threading.

## Proposed refactor
1. Remove the `= new ParameterState(...)` default from all four visitors; make `state`
   required (or move it into `VisitContext` per `sql-visitor/task-1.md`).
2. Update any direct test callers to pass an explicit shared `ParameterState`.
3. Optionally add an assertion/dev-time guard that a single `ParameterState` instance is
   used per `toSql` call.

## Suggested design patterns
- **Required collaborator / no-default-for-stateful-deps** — *Why*: a shared mutable counter
  must never be silently re-created.
- **Context Object** (with `sql-visitor/task-1.md`) — *Why*: the canonical home for the
  shared state.

## Testing plan
- **Unit**: a multi-clause predicate (two literals) numbers placeholders `$1, $2` (not
  `$1, $1`) — regression guard for positional style.
- **Type-level**: omitting `state` is now a compile error.
- **Regression**: existing visitor tests updated to pass explicit state, green.

## Acceptance criteria
- [ ] No visitor defaults `ParameterState`.
- [ ] Positional-numbering regression test added.
- [ ] All direct callers pass a shared state.
- [ ] Existing tests green.

## Refactor order
Land with or right after `sql-visitor/task-1.md`.

## Notes
Removing a default parameter on exported methods is technically a signature change; if these
visitors are truly internal collaborators, also consider not exporting them (see
`sql-visitor/task-4.md`).
