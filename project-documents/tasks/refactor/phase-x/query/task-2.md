---
status: not-started
phase: phase-x
package: query
priority: P0
effort: L
risk: high
category: architecture
depends_on: []
related: ["query/task-1.md"]
---

# Refactor: Make `Queryable<T>` consistently immutable (fix shared-mutable-state aliasing)

## Problem
`Queryable<T>` is **inconsistently immutable**. Some chainable methods clone before
mutating (returning a fresh instance), while others mutate `this._model` in place and
`return this`. A `grep` shows **23 `return this;`** vs **18 `this.clone()`** in the same
file. Because consumers naturally treat a `Queryable` as a reusable, side-effect-free
builder (EF Core / LINQ semantics), the mutating methods cause **aliasing bugs**: deriving
two queries from one base silently corrupts both.

### Mutating (in-place) methods — `return this`
- `whereIn` (`Queryable.ts:484-514`), `whereCompiled` (`:640-655`),
  `whereExists` (`:678-688`), `whereInSubquery` (`:691-704`),
  `take` (`:804-807`), `skip` (`:812-815`), `distinct` (`:820-823`),
  `union`/`unionAll` (`:826-844`), `groupBy` (`:911-915`),
  `havingCompiled` (`:941-956`), `orderBy`/`orderByDescending` (mutate then wrap,
  `:767-798`), `ignoreQueryFilters` (`:609-616`), `fallbackTo` (`:661-664`),
  `withAbort` (`:1514-1517`).

### Cloning (immutable) methods — `this.clone()`
- `tagWith`/`tagWithCallSite` (`:268-295`), `asNoTracking`/`asTracking`/… (`:225-246`),
  `asSplitQuery`/`asSingleQuery` (`:324-349`), all `temporal*` (`:368-427`),
  `withCte` (`:707-716`), `except`/`intersect`/`concat` (`:1559-1594`),
  `withFallbackPolicy` (`:667-675`), `_withRawSqlSource` (`:435-439`).

## Evidence
- `grep -c "return this;"` → 23; `grep -c "this.clone()"` → 18 in
  `packages/query/src/Queryable.ts`.
- Concrete hazard: `const base = ctx.users.orderBy('id'); const a = base.take(10);
  const b = base.take(20);` — `take` mutates `base._model.limit`, so `a` and `b` share the
  last-written limit. Contrast with `asSplitQuery()` which clones.

## Why this is bad
- **Principle of least astonishment / Clean Code**: a fluent builder must behave
  predictably. Mixed semantics are a latent correctness defect, not a style nit.
- **Concurrency/reuse**: any code that caches a base queryable and forks it is unsafe.
- **Blocks decomposition** (`query/task-1.md`): extracted collaborators need a single,
  well-defined "return a derived instance" contract.

## Target architecture
Adopt **uniform immutability** (persistent/functional builder). Every chainable operator
returns a new `Queryable` built from a derived `QueryModel`; no method mutates `this`.
This aligns runtime behavior with type-level/EF-Core expectations and supports safe
sharing — a direct application of Clean Code's "no surprising side effects" and the
**immutable value object** pattern.

## Proposed refactor
1. Introduce a private `withModel(mutator: (m: QueryModel) => void): Queryable<T>` helper
   that clones, applies the mutation to the clone, and returns it.
2. Convert every `return this`-after-mutation method to `return this.withModel(...)`.
3. For `orderBy`/`orderByDescending`, build the `OrderedQueryable` from the *cloned*
   instance (today `OrderedQueryable._fromQueryable` wraps the mutated `this`).
4. Keep `_whereSignature`, `_includes`, `_filteredIncludes`, `_lastIncludePath` updates
   inside the clone, never on `this`.
5. Audit `fallbackTo`/`withAbort` — these mutate non-model state; either clone or document
   them explicitly as terminal-config setters (prefer clone for consistency).

## Suggested design patterns
- **Immutable Value Object / Persistent Builder** — *Why*: eliminates aliasing, enables
  safe reuse and parallel forks, matches LINQ semantics.
- **Template Method** (`withModel`) — *Why*: one canonical derive-and-mutate path so the
  pattern can't be applied inconsistently again.

## Testing plan
- **Regression**: add a "fork safety" test — derive two queries from one base via each
  operator and assert they don't interfere.
- **Unit**: assert each operator returns a *new* reference (`expect(q.take(1)).not.toBe(q)`).
- **Contract**: existing `Queryable.test.ts` must remain green.

## Acceptance criteria
- [ ] No chainable operator mutates `this._model` (zero post-mutation `return this`).
- [ ] `withModel()` helper exists and is the only derive path.
- [ ] Fork-safety regression test added and passing.
- [ ] `orderBy().thenBy()` chain still works on a fresh instance.
- [ ] Existing tests green.

## Refactor order
Land before / alongside `query/task-1.md` (decomposition relies on the immutable derive
contract).

## Notes
This is a **behavioral change** for code that (perhaps accidentally) relied on mutation —
warrants a changeset (`minor` or `major` depending on observed breakage) with migration
notes.
