---
status: not-started
phase: phase-x
package: plugin-audit
priority: P2
effort: S
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Collapse the dual flat/nested audit option model

## Problem

`AuditOptions` offers two overlapping ways to configure the same columns: flat
(`createdAtColumn`/`updatedAtColumn`/`createdByColumn`/`updatedByColumn`) and nested
(`timeColumns.{createdAt,updatedAt}` / `userColumns.{createdBy,updatedBy}`), with the nested form
silently winning. This is redundant, ambiguous, and undocumented as to precedence.

## Evidence

- `packages/plugin-audit/src/types.ts:15-56` — declares both flat columns AND nested
  `timeColumns`/`userColumns`.
- `packages/plugin-audit/src/AuditMiddleware.ts:56-57` — nested overrides flat:
  ```ts
  const createdAtCol = this.options.timeColumns?.createdAt || this.options.createdAtColumn!;
  const createdByCol = this.options.userColumns?.createdBy || this.options.createdByColumn!;
  ```
  (same pattern at :77-78). The precedence is implicit and unexplained.
- The `utils.ts` `getAuditInfo`/`withAudit` helpers only know the *flat* form
  (`utils.ts:29-32`), so the two helper families and the middleware disagree on the option model.

## Why this is bad

- **Two ways to do one thing** → ambiguity, surprising overrides, larger API surface.
- The read helpers (`getAuditInfo`) ignore the nested form entirely, so configuring via
  `timeColumns` makes the helpers read the wrong columns — an inconsistency bug.
- Violates "keep APIs cohesive / predictable / discoverable" (project rule §6).

## Target architecture

One coherent option shape. Recommend keeping the flat form (simpler, already supported by helpers) and
removing the nested form, OR fully adopting nested and updating helpers — but not both. Apply
**Interface Segregation** and **least surprise**.

## Proposed refactor

1. Choose one option model (recommend flat).
2. Remove the other; if backward-compat needed, deprecate with a clear precedence note for one release.
3. Make `getAuditInfo`/`withAudit` and the middleware read the *same* model.
4. Changeset (`minor` deprecation or `major` removal).

## Suggested design patterns

- **Interface Segregation**, **least surprise / single canonical config**.

## Testing plan

- Option-precedence test removed/replaced; one model exercised everywhere.
- `getAuditInfo` reads the same columns the middleware writes.

## Acceptance criteria

- [ ] Exactly one option model for audit columns.
- [ ] Middleware and helpers agree on the model.
- [ ] Changeset added.

## Refactor order

1. Choose model. 2. Remove the other. 3. Align helpers. 4. Changeset.

## Notes

The helper/middleware disagreement (`getAuditInfo` ignores nested columns) is a latent correctness bug,
not just style.
