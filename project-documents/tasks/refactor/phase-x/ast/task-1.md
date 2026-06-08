---
status: completed
phase: phase-x
package: ast
priority: P1
effort: S
risk: medium
category: typescript
depends_on: []
related: []
---

# Refactor: De-duplicate the `jsonPath` node — `JsonPathNode` vs `JsonPathExpression`

## Problem
The AST package declares the JSON-path node **twice**, in two files, as two structurally
identical-but-separate interfaces. One (`JsonPathExpression`) is the documented, exported
node; the other (`JsonPathNode`) is re-declared inline inside `Nodes.ts` with a comment that
falsely claims it is "Re-export from JsonPathExpression … Imported inline to avoid a separate
module". They are not linked — they are two independent types that happen to match today and
can silently diverge tomorrow.

## Evidence
- `packages/ast/src/ast/JsonPathExpression.ts:9` — `export interface JsonPathExpression { type: 'jsonPath'; column: string; path: string[]; cast?: 'text'|'int'|'bool'|'float' }`.
- `packages/ast/src/ast/Nodes.ts:163-168` — `export interface JsonPathNode { type: 'jsonPath'; column: string; path: string[]; cast?: 'text'|'int'|'bool'|'float' }` with the misleading comment at lines 159-162 ("Re-export from JsonPathExpression … Imported inline").
- `Nodes.ts:157` — the `ExpressionNode` union references `JsonPathNode` (the local copy), **not** `JsonPathExpression`.
- Both are re-exported from `packages/ast/src/index.ts:2-3` (`export * from './ast/JsonPathExpression'` and `'./ast/Nodes'`), so consumers see two near-identical exported names for one concept.

## Why this is bad
- **Divergence risk**: a future edit to one (e.g. adding a `cast: 'date'` variant) leaves the other stale; the `ExpressionNode` union would silently use the un-updated copy.
- **API confusion**: two exported names (`JsonPathNode`, `JsonPathExpression`) for the same node mislead consumers and the rewriter/visitor code.
- **False documentation**: the comment claims a re-export that does not exist.

## Target architecture
One canonical `jsonPath` node definition, imported where the `ExpressionNode` union needs it.
The AST package is otherwise exemplary (pure node definitions, typed errors, no SQL emission),
so this is about restoring single-source-of-truth for one node.

## Proposed refactor
1. Keep `JsonPathExpression` (in `JsonPathExpression.ts`) as the single source of truth.
2. In `Nodes.ts`, `import type { JsonPathExpression } from './JsonPathExpression'` and use it directly in the `ExpressionNode` union; delete the inline `JsonPathNode` interface.
3. If `JsonPathNode` must remain for backward compatibility, make it a `type JsonPathNode = JsonPathExpression` alias (not a separate interface) and `@deprecated` it.
4. Fix the misleading comment.
5. Verify the AST→SQL visitor (in the dialect/query layer) references the canonical type.

## Suggested design patterns
- **Single Source of Truth** for the node contract.
- **Type alias for backward compatibility** if the old name is part of the public API.

## Testing plan
- Type-level: `ExpressionNode` includes the canonical `JsonPathExpression`; `JsonPathNode` (if kept) is assignable to it.
- Build: no duplicate-symbol confusion; downstream visitor compiles unchanged.
- Regression: JSON-path translation tests pass.

## Acceptance criteria
- [x] Only one `jsonPath` interface definition exists.
- [x] `ExpressionNode` references the canonical type.
- [x] Misleading comment removed/corrected.
- [x] Backward-compatible export (alias) if the old name was public.
- [x] Validations pass.

## Resolution
Single source of truth restored. `Nodes.ts` now imports `JsonPathExpression` and the
`ExpressionNode` union references it directly; the inline duplicate interface and the false
"re-export" comment were removed. `JsonPathNode` is retained as a `@deprecated` type alias
(`export type JsonPathNode = JsonPathExpression`) for backward compatibility, since it was a
public export consumed by `sql-visitor` and all three dialects. All internal consumers were
migrated to the canonical `JsonPathExpression` (re-exported from `@ts-linq/sql-visitor`); the
deprecated alias now exists only for external consumers and is slated for removal in a future
major. Changeset: `@ts-linq/ast` minor, `@ts-linq/sql-visitor` minor, dialects patch.

## Refactor order
Standalone; do first in the ast package (smallest, unblocks confusion before other edits).

## Notes
Changing/removing a public exported name is a `minor`/`major` concern; prefer the deprecated
alias path to stay backward-compatible. Confirm whether downstream packages import
`JsonPathNode` by name (grep the monorepo) before removing it outright.
