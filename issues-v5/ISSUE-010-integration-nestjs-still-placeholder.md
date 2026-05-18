# ISSUE-010: `@ts-linq/integration-nestjs` is still an unimplemented placeholder

## Severity

Low

## Category

- Documentation Drift
- Maintainability

## Location

- `packages/integration-nestjs/src/index.ts` — 2 LOC, no implementation
- `packages/integration-nestjs/package.json` — declared but empty package
- Root `README.md` — references NestJS integration as a supported feature
- `issues-v4/ISSUE-019-integration-nestjs-placeholder.md` — original v4 finding (Low, still open)

## Problem

This is a **carry-over** from audit v4. ISSUE-019 v4 documented that the `@ts-linq/integration-nestjs` package contains no implementation — only a 2-line `src/index.ts`. The README / TypeDoc still advertise the integration as supported. No work has landed since.

Two equally valid resolutions are blocked by indecision:

1. Implement the integration (NestJS module factory, request-scoped `DbContext` provider, dynamic module configuration, lifecycle hooks for transactions). This is a non-trivial multi-day task.
2. Remove the package and remove all README / TypeDoc references that imply support. This is a 10-minute task.

Leaving it as a placeholder is the worst of both worlds: ecosystem search engines (npm, GitHub) surface the package; users who depend on it find nothing inside.

## Evidence

- `packages/integration-nestjs/src/index.ts` content (2 LOC, single re-export stub).
- `issues-v4/ISSUE-019-integration-nestjs-placeholder.md` — full original analysis.
- `issues-v4/README.md` — lists ISSUE-019 as the single remaining open issue from v4.
- Audit-v4 followups closed every other Low finding (ISSUE-020 done); only this one remains untouched.

## Why It Matters

- **Documentation drift**: README advertises a feature that does not exist. New users hit a wall on first integration attempt.
- **Discoverability noise**: A stub package complicates `pnpm` workspace navigation, CI build pipelines (one extra package to build even though it produces no output), and dependency-cruiser configuration.
- **Decision debt**: Every audit pass re-discovers the same finding. The signal-to-noise of the audit decreases over time when known issues persist.

## Recommended Fix

Pick one. Either is acceptable; both close the issue.

A. **Remove the package**.
- Delete `packages/integration-nestjs/`.
- Remove from `pnpm-workspace.yaml`.
- Remove README mentions; update TypeDoc nav.
- Add a note to the changelog: "NestJS integration removed; will be reintroduced as a separate package when ready."

B. **Implement a minimal viable integration**.
- Add `ts-linq.module.ts` (dynamic NestJS module).
- Add `DbContextProvider` (request-scoped or singleton).
- Add `@InjectDbContext()` decorator.
- Add one example app under `packages/examples/`.
- Add e2e test under `packages/e2e-tests/`.

## Acceptance Criteria

- Either `packages/integration-nestjs/` is deleted entirely (and references removed), OR its `src/` contains a working module with at least one example app demonstrating injection and one e2e test.
- README and TypeDoc accurately reflect the chosen outcome.
- `pnpm build && pnpm test` green.
