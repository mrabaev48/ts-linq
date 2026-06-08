---
status: completed
phase: phase-x
package: ast
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: []
related: []
---

# Refactor: Clarify or relocate the SQL-string DTOs (`ConditionFragment`, `SqlFragment`) leaking into the pure-AST package

## Problem
`@ts-linq/ast` is, by design and almost entirely in practice, a *pure* package of AST node
definitions, a Specification abstraction, and typed errors — it contains **no** SQL string
generation. The one exception is `packages/ast/src/types.ts`, which defines two DTOs that are
SQL-*string* shaped (`{ condition: string; parameters }` and `{ fragment: string; params }`).
These describe already-rendered SQL fragments, which is a generation/dialect concern, not an
AST-node concern. Their presence muddies the package's otherwise-clean boundary.

## Evidence
- `packages/ast/src/types.ts:3-6` — `interface ConditionFragment { condition: string; parameters: SqlParameter[] }`.
- `packages/ast/src/types.ts:8-11` — `interface SqlFragment { fragment: string; params: SqlParameter[] }`.
- `packages/ast/src/index.ts:7` — `export * from './types'` (these become part of the AST public API).
- By contrast, every other file in the package is pure: `Nodes.ts`, `JsonPathExpression.ts`,
  `RawSqlNode.ts` (a *descriptor*, explicitly noted as "NOT part of ExpressionNode"),
  `Specification.ts`, `errors.ts` — none emit or shape SQL strings.

## Why this is bad
- **Boundary clarity**: a "pure AST" package exporting rendered-SQL-fragment DTOs invites future SQL-generation logic to creep in here.
- **Cohesion**: these DTOs belong with the SQL-generation/dialect layer that actually produces fragments.
- **Misleading surface**: consumers may assume the AST package participates in rendering.

## Target architecture
Decide the rightful home for SQL-fragment DTOs. If they describe the *output* of SQL
generation, move them to the dialect/query/SQL-generation package and import from there. If
they are genuinely a neutral data carrier used across the AST boundary, keep them but document
that the AST package defines the *carrier shape only* and never produces the strings. Either
way, make the intent explicit so the pure-AST invariant is protected.

## Proposed refactor
1. Grep the monorepo for `ConditionFragment` / `SqlFragment` usages to locate their real producers/consumers.
2. If produced/consumed only by the SQL-generation layer, relocate the interfaces there and remove from `@ts-linq/ast` (or re-export with `@deprecated`).
3. If they must stay, add a module doc to `types.ts` stating the AST package defines the shape but never generates SQL, and verify `arch:deps` shows no generation dependency was added.
4. Keep `RawSqlNode` where it is (it is a query-source *descriptor*, correctly modeled).

## Suggested design patterns
- **Ports-and-Adapters boundary hygiene** — keep rendering DTOs on the rendering side.
- **Single-responsibility per package**.

## Testing plan
- `arch:deps`/`madge`: no SQL-generation dependency introduced into `@ts-linq/ast`.
- Build: relocated/re-exported types still resolve for consumers.
- Regression: no behaviour change (pure type move).

## Acceptance criteria
- [ ] `ConditionFragment`/`SqlFragment` either relocated to the generation layer or explicitly documented as neutral carriers.
- [ ] `@ts-linq/ast` confirmed free of SQL-string generation.
- [ ] `arch:deps` clean; validations pass.

## Refactor order
Low priority; do after `ast/task-1` (node de-dup). Investigation-first — confirm usage before moving.

## Notes
This is a *lower-priority investigation/cleanup* task: the boundary risk is latent, not active.
The headline finding for ast is positive — the package is already the cleanest in the cluster
(pure nodes + typed errors, no provider/dialect/SQL leakage). The known-evidence concern "verify
no SQL string generation leaks back into ast" is confirmed clean apart from these two carrier DTOs.
