# ISSUE-022: Orphan (Dead) Source Files in @ts-linq/core and Plugins

## Severity

Medium

## Category

- Maintainability
- Clean Code

## Location

**@ts-linq/core (production code, never imported):**
- `packages/core/src/decorators/ComputedColumn.ts`
- `packages/core/src/decorators/DatabaseFunction.ts`
- `packages/core/src/decorators/utils.ts`
- `packages/core/src/types/Logger.ts`
- `packages/core/src/utils/MetricsSafe.ts`

**Plugins (production code, never imported):**
- `packages/plugin-audit/src/types.ts`
- `packages/plugin-multi-tenant/src/types.ts`

## Problem

`dependency-cruiser` (`pnpm arch:deps`) flags the above 7 source files under the `no-orphans` rule: they exist in production source directories but are never imported by any other file in the project.

### @ts-linq/core decorators — leftover duplicates after migration

`packages/core/src/decorators/` is a **surviving copy** of decorator files that were migrated to `@ts-linq/metadata`. Both packages contain identical (or near-identical) files:

| File in `core/src/decorators/` | Counterpart in `metadata/src/` | Status |
|---|---|---|
| `ComputedColumn.ts` | `metadata/src/ComputedColumn.ts` | duplicate |
| `DatabaseFunction.ts` | `metadata/src/DatabaseFunction.ts` | duplicate |
| `Column.ts` | `metadata/src/Column.ts` | duplicate |
| `Entity.ts` | `metadata/src/Entity.ts` | duplicate |
| `PrimaryKey.ts` | `metadata/src/PrimaryKey.ts` | duplicate |
| `Relationships.ts` | `metadata/src/Relationships.ts` | duplicate |
| `ValidIf.ts` | `metadata/src/ValidIf.ts` | duplicate |

Tests confirm: `packages/metadata/tests/decorators.test.ts` imports `ComputedColumn` and `DatabaseFunction` from `../src/` (i.e., `metadata/src/`) — the live copies. The `core/src/decorators/` versions are never imported.

### Other orphans

- `core/src/types/Logger.ts`: logger interface not exported from core index; likely superseded by logger types in `@ts-linq/types`.
- `core/src/utils/MetricsSafe.ts`: wrapping utility not exported; likely superseded by the dedicated `@ts-linq/metrics-safe` package.
- `plugin-audit/src/types.ts`, `plugin-multi-tenant/src/types.ts`: internal type files not exported from plugin indexes.

In all cases, orphan production files increase the maintenance surface, may mislead contributors, and inflate the published package size.

## Evidence

`pnpm arch:deps:json` (dependency-cruiser) — rule `no-orphans` (severity: **warn**):
```
packages/core/src/decorators/ComputedColumn.ts
packages/core/src/decorators/DatabaseFunction.ts
packages/core/src/decorators/utils.ts
packages/core/src/types/Logger.ts
packages/core/src/utils/MetricsSafe.ts
packages/plugin-audit/src/types.ts
packages/plugin-multi-tenant/src/types.ts
```

Test/config orphans (expected, acceptable): `jest.config.js`, `jest.sequencer.js`, `setup-containers.ts` across multiple packages — these are not production code concerns.

## Why It Matters

- **Maintenance overhead**: Contributors may modify orphan files not realizing no consumer exists.
- **API confusion**: `ComputedColumn.ts` and `DatabaseFunction.ts` decorator files suggest functionality (computed columns, database functions) that users cannot access because the decorators are not exported.
- **Published package size**: Orphan files are included in compiled `dist/` output, increasing package size for no benefit.
- **Test coverage gap**: Unreachable code cannot be covered by tests, lowering meaningful coverage metrics.

## Recommended Fix

For each orphan, one of:

1. **Wire it up**: Add the export to the package's `index.ts` if the functionality is intentional.
2. **Delete it**: Remove the file if the functionality is superseded or planned but abandoned.
3. **Document it**: If it's an in-progress feature, add a `// TODO:` comment or open a tracking issue.

Specific recommendations:
- `core/src/decorators/` (all decorator files): **delete** — live counterparts exist in `packages/metadata/src/`; keeping both risks divergence.
- `core/src/types/Logger.ts`: check if superseded by logger types in `@ts-linq/types`; if so, delete.
- `core/src/utils/MetricsSafe.ts`: check if superseded by `@ts-linq/metrics-safe` package; if so, delete.
- `plugin-audit/src/types.ts`, `plugin-multi-tenant/src/types.ts`: either export from plugin index or inline into the consuming file.

## Acceptance Criteria

- `pnpm arch:deps` reports zero `no-orphans` violations for production source files (non-test, non-config).
- Each of the 7 files is either exported from its package index, deleted, or has a documented reason for being unexported.
