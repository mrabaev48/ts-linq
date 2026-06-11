---
status: completed
phase: phase-x
package: query
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: []
related: ["query/task-1.md", "query/task-2.md"]
---

# Refactor: Replace the 11-parameter `Queryable` constructor with a `QueryContext` value object

## Problem
`Queryable`'s constructor takes **11 positional, mostly-optional parameters**
(`Queryable.ts:110-122`): `entityClass, provider, entityLoader, entityCache, performance,
globalFilters, softDeleteOptions, entityAttacher, trackingMode, globalSplittingBehavior,
entityQueryFilters`. The exact ordering must be reproduced verbatim at **four** call sites:
constructor (`:110`), `clone()` (`:178-190`), `selectCompiled()` (`:739-745`, which drops
several args), and `ofType()` (`:858-869`, which passes `undefined` placeholders for
positions 8-9). Each is a long-parameter-list / positional-coupling smell.

## Evidence
- Constructor: `Queryable.ts:110-122`.
- `clone()` re-passes all 11: `Queryable.ts:178-190`.
- `ofType()` passes positional `undefined`s for tracking/attacher to shift later args:
  `Queryable.ts:858-869`.
- `selectCompiled()` silently constructs with only the first 5 args, *losing*
  `globalFilters`, `softDeleteOptions`, `entityAttacher`, `trackingMode`,
  `globalSplittingBehavior`, `entityQueryFilters` (`Queryable.ts:739-745`) — a likely
  latent bug: a projected query loses its tracking/filter configuration.

## Why this is bad
- **Connascence of position**: adding/reordering one parameter breaks four call sites
  silently (TypeScript can't catch a wrong-but-same-typed positional arg).
- **Clean Code**: functions should take few parameters; 11 is far past the threshold.
- **Latent defect**: `selectCompiled` dropping config (see evidence) is exactly the kind
  of bug a value object prevents — you copy one context reference instead of remembering
  11 positions.

## Target architecture
Introduce an immutable `QueryContext` value object bundling all the cross-cutting,
chain-invariant configuration (provider, loader, cache, performance, global filters,
soft-delete, attacher, tracking mode, splitting default, entity query filters). The
`Queryable` constructor becomes `(entityClass, context, model?)`. `clone()`,
`selectCompiled()`, `ofType()` copy the single context reference (immutable, shareable).

## Proposed refactor
1. Define `interface QueryContext` (or `class` for ergonomics) holding the 9 cross-cutting
   fields; mark `@internal`.
2. Change `Queryable` constructor to `(entityClass, context, model?)`.
3. Update the four call sites to pass `this._context` (or a `with`-derived copy for
   per-chain overrides like tracking mode / splitting behavior).
4. Fix `selectCompiled` to carry the full context (closes the latent config-loss bug).
5. Build `QueryContext` once in the DbSet/DbContext factory and thread it through.

## Suggested design patterns
- **Value Object / Parameter Object** — *Why*: collapses 11 positional args into one
  cohesive, immutable, copy-by-reference unit; eliminates positional connascence.
- **Wither pattern** (`context.with({ trackingMode })`) — *Why*: per-chain overrides stay
  immutable and explicit instead of positional `undefined` juggling.

## Testing plan
- **Unit**: `QueryContext.with()` returns a new context with one field changed, others
  preserved.
- **Regression**: add a test proving `select(...)` (projection) preserves tracking mode and
  global filters (guards the fixed bug).
- **Contract**: existing query tests green.

## Acceptance criteria
- [ ] `QueryContext` value object introduced and `@internal`-tagged.
- [ ] `Queryable` constructor takes `(entityClass, context, model?)`.
- [ ] All four construction sites pass a context, not positional args.
- [ ] `selectCompiled` preserves full context (regression test added).
- [ ] Existing tests green.

## Refactor order
First in the query cluster — unblocks `query/task-1.md` and `query/task-2.md`.

## Notes
The `selectCompiled` config-loss is a real bug, not just a smell — call it out in the
changeset.
