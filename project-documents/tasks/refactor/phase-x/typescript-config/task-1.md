---
status: not-started
phase: phase-x
package: typescript-config
priority: P1
effort: M
risk: medium
category: typescript
depends_on: []
related: ["eslint-config/task-1.md"]
---

# Refactor: Add staged strictness flags, leading with noUncheckedIndexedAccess

## Problem

The shared base preset enables only `strict: true` and omits the additional strictness flags
that catch the bug classes most relevant to a metadata-driven ORM — chiefly
`noUncheckedIndexedAccess`. As a result, array/`Map` index access is typed as always-defined
across the codebase, and the type system cannot catch the `undefined` cases that exist in
practice.

## Evidence

- `packages/typescript-config/base.json:7` — `"strict": true` is the only safety setting; no
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.
- Concrete impact in this cluster: `packages/testkits/src/TestProvider.ts:222-234` treats
  `pks[0]` and `meta.columns.find(...)` results as defined; `:495-497` indexes `parts[1]`
  without a guard. Under `noUncheckedIndexedAccess` these would be flagged, surfacing the real
  `undefined` paths the code currently `!`-asserts away.
- Index/`Map.get` access of this shape is pervasive across metadata/columns/paths throughout
  the ORM, so the missing flag has broad reach.

## Why this is bad

- An ORM's core operations are index/key lookups (`columns[i]`, `primaryKeys[0]`,
  `map.get(name)`); without `noUncheckedIndexedAccess` the compiler assumes these never miss,
  so missing-row/missing-column bugs only appear at runtime.
- The project's own rules ("Keep runtime behavior aligned with type-level behavior",
  "Make illegal states unrepresentable") are undercut by the missing flags.
- Each package would otherwise have to opt in individually; centralising the policy is the
  point of a shared preset.

## Why this is bad (catch-block audit)

Not applicable (config file).

## Target architecture

Apply a **strictness ratchet** (Clean Code: tighten the compiler to the level the design
already assumes):

- Enable the highest-value flags in `base.json` on a staged plan, leading with
  `noUncheckedIndexedAccess`, then `noImplicitOverride`, `noFallthroughCasesInSwitch`, and
  evaluate `exactOptionalPropertyTypes` (highest churn — schedule last/optional).
- Each flag is enabled only after its violation backlog is fixed or explicitly localised, so a
  flip never produces an unreviewable diff.

## Proposed refactor

1. Run `pnpm typecheck` with each candidate flag enabled in isolation to size the backlog.
2. Enable `noImplicitOverride` + `noFallthroughCasesInSwitch` first (typically low backlog).
3. Stage `noUncheckedIndexedAccess`: fix index/`Map.get` sites (guards or
   localised assertions with reasons), then enable.
4. Evaluate `exactOptionalPropertyTypes` separately; defer if backlog is large.
5. Add a preset-sanity fixture compile to lock the flags in.

## Suggested design patterns

- **Ratchet / Baseline** — fix-then-enable per flag. WHY: avoids a monorepo-wide breakage in
  one commit.
- **Make illegal states unrepresentable** — index access yields `T | undefined`. WHY: the
  type system models reality (lookups can miss).

## Testing plan

- `pnpm typecheck` is clean monorepo-wide after each flag flip.
- Spot-check that previously-`!`-asserted sites (e.g. `TestProvider` PK lookups) now compile
  with explicit guards.

## Acceptance criteria

- [ ] `noUncheckedIndexedAccess` enabled in `base.json` with the backlog resolved.
- [ ] `noImplicitOverride` and `noFallthroughCasesInSwitch` enabled.
- [ ] `exactOptionalPropertyTypes` either enabled or explicitly deferred with a follow-up.
- [ ] Monorepo `pnpm typecheck` passes.

## Refactor order

1. Size backlogs.
2. Enable low-churn flags.
3. Stage `noUncheckedIndexedAccess`.
4. Decide on `exactOptionalPropertyTypes`.

## Notes

- Pairs with eslint-config/task-1 (`no-unsafe-*`): together they restore the type+lint
  discipline the project rules require. Large backlogs may need per-cluster follow-ups.
