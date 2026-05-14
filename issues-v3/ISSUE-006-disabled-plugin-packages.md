# ISSUE-006: Three Plugin Packages Permanently Build-Disabled in Monorepo

## Severity

High

## Category

- Build/Tooling
- Maintainability
- Clean Architecture

## Location

- `packages/plugin-soft-delete/package.json:17`
- `packages/plugin-audit/package.json:17`
- `packages/plugin-multi-tenant/package.json:17`
- `pnpm-workspace.yaml`
- `turbo.json`

## Problem

All three plugin packages have their `build` script replaced with a no-op shell echo:

```json
// packages/plugin-soft-delete/package.json
"scripts": {
  "build": "echo 'Build temporarily disabled - TypeScript monorepo config issue'"
}
// same in plugin-audit/package.json and plugin-multi-tenant/package.json
```

These packages are:
- Registered in the pnpm workspace (consumers can reference them)
- Included in Turbo's build graph
- Listed as published packages in the monorepo
- **But they produce no build output** — no `dist/`, no compiled types

The word "temporarily" is misleading. There is no tracking issue, no timeline, and no workaround. The packages exist as dead code entries in the workspace.

## Evidence

- `packages/plugin-soft-delete/package.json` — `"build": "echo 'Build temporarily disabled - TypeScript monorepo config issue'"`
- `packages/plugin-audit/package.json` — same
- `packages/plugin-multi-tenant/package.json` — same
- Turbo's `turbo.json` includes these packages in the build pipeline, meaning `turbo build` silently skips them without error
- The soft-delete and audit functionality is instead partially implemented inside `DbContext` directly (see ISSUE-002), making the plugin architecture speculative

## Why It Matters

- **Maintainability risk**: The plugin architecture (soft-delete, audit, multi-tenancy as separate plugins) is the intended long-term design, but the actual implementation of soft-delete and audit lives directly in `DbContext`. This creates a gap between the stated architecture and the reality.
- **Dead code risk**: Source files in these packages compile (or fail to compile) silently. Bugs, type errors, and API mismatches in plugin source accumulate invisibly.
- **Coupling risk**: Because plugins can't build, soft-delete and audit are baked into `DbContext` as first-class concerns rather than injectable plugins, increasing `DbContext`'s complexity (see ISSUE-002).
- **API stability risk**: Future consumers building on the plugin contract have no guarantee the interface is stable or even functional.
- **Build/Tooling risk**: `turbo build` reports success even when 3 packages have not produced any output. CI green does not mean the plugin surface is healthy.

## Recommended Fix

Choose one of the following, and track the decision explicitly:

**Option A — Fix and re-enable the plugins**:
1. Diagnose the TypeScript monorepo config issue (likely `tsconfig.json` project references or path aliasing)
2. Fix the `tsconfig.json` in each plugin package
3. Restore the real build script
4. Add integration tests for each plugin

**Option B — Remove the plugin packages until they are ready**:
1. Remove `plugin-soft-delete`, `plugin-audit`, `plugin-multi-tenant` from the workspace
2. Keep their intended API in a design document or `ROADMAP.md`
3. Re-add them when the plugin system is properly designed

**Option C — Extract functionality from DbContext into plugins as the first step**:
1. Fix the build issue
2. Move soft-delete and audit logic from `DbContext` into `plugin-soft-delete` and `plugin-audit` respectively
3. `DbContext` accepts plugins via `DbContextOptions.plugins`

Option C aligns with fixing ISSUE-002 simultaneously.

## Acceptance Criteria

- No package in the workspace has a build script that is a no-op shell echo
- Either all three plugins build successfully and produce typed output, OR they are removed from the workspace
- Soft-delete and audit logic is either in a working plugin OR cleanly contained in `DbContext` with a clear comment that plugins are planned
- `turbo build` output accurately reflects whether plugin packages built
