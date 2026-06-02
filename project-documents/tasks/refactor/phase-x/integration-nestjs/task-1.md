---
status: not-started
phase: phase-x
package: integration-nestjs
priority: P2
effort: S
risk: low
category: documentation
depends_on: []
related: ["integration-nestjs/task-2.md", "examples/task-1.md"]
---

# Refactor: Decide whether to implement or remove the NestJS integration

## Problem

`@ts-linq/integration-nestjs` is an empty placeholder that has shipped as a versioned package
(`2.0.0-alpha.1`) since at least the current tree, advertising a NestJS integration that does not exist.

## Evidence

- `packages/integration-nestjs/src/index.ts:1-2` — entire source:
  ```ts
  // NestJS Integration - Coming Soon
  export const placeholder = 'integration-nestjs';
  ```
- `packages/integration-nestjs/package.json:24-28` — devDependencies only; no `@nestjs/*` dependency.
- No `test` script (package.json:16-20 has `build`/`clean`/`typecheck` only); no tests directory.
- Committed build artifact `packages/integration-nestjs/tsconfig.tsbuildinfo`.

## Why this is bad

- **Placeholder-as-deliverable:** the package list implies a NestJS integration exists.
- Dead versioned surface that the changeset/release process must keep stepping over.
- Tracked `tsconfig.tsbuildinfo` is build noise that should be gitignored.

## Target architecture

A binary, recorded decision:

- **Implement** → schedule `task-2` (design) and a build-out epic; add `@nestjs/*` peer deps and tests.
- **Remove** → delete the package from the workspace, remove it from any release config, and (if a
  consumer-facing promise exists) note it in the roadmap instead of as a code package.

Apply **YAGNI** and "the package list must reflect reality".

## Proposed refactor

1. Product/architecture decision: implement now, later, or remove.
2. If remove: delete `packages/integration-nestjs`, scrub references, gitignore `*.tsbuildinfo`.
3. If implement-later: keep but clearly mark as roadmap-only (no versioned publish) and remove the
   misleading `placeholder` export.
4. If implement-now: proceed to `task-2`.

## Suggested design patterns

- N/A (decision/governance). Principle: **YAGNI**, no speculative empty packages.

## Testing plan

- Remove path: grep confirms no importers; workspace builds without the package.
- Keep path: package is excluded from publishable release set.

## Acceptance criteria

- [ ] A recorded decision (implement / later / remove).
- [ ] If removed: package gone, no dangling references, `*.tsbuildinfo` gitignored.
- [ ] If kept: no misleading `placeholder` export implying a working integration.

## Refactor order

1. Decision. 2. Execute (remove or mark roadmap). 3. Cleanup artifacts.

## Notes

Pairs with `examples/task-1` (the other placeholder); both should be resolved together for a coherent
package list.
